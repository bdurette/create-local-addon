const fs = require('fs');
const os = require('os');
const fetch = require('node-fetch');
const chalk = require('chalk');
const unzipper = require('unzipper');
const Generator = require('yeoman-generator');

const { platforms, apps, removeDirectory, getLocalDirectory, confirmLocalInstallations, confirmExistingLocalAddons, enableAddon } = require('./utils');
const { ascii } = require('./ascii.js');

class LocalAddonGenerator extends Generator {
    constructor(args, opts) {
        super(args, opts);

        this.argument('name', {
            required: false,
            type: String,
            desc: 'Internal name for the new add-on'
        });
        // this.argument('productname', {
        //     required: false,
        //     type: String,
        //     desc: 'Display name for the new add-on'
        // });

        this.option('beta', {
            type: Boolean,
            desc: 'Preference to install add-on for Local Beta',
            default: false
        });
        this.option('place-directly', {
            type: Boolean,
            desc: 'Place add-on directory directly into Local add-ons directory (automatically adds --do-not-symlink)',
            default: false
        });
        this.option('do-not-symlink', {
            type: Boolean,
            desc: 'Skip creating a symbolic link in Local add-ons directory to your add-on directory',
            default: false
        });
        this.option('disable', {
            type: Boolean,
            desc: 'Skip enabling add-on',
            default: false
        });

        this.localApp = 'Local';
        this.existingAddons = new Set();
        
        this.addonBoilerplate = 'https://github.com/ethan309/clone-test/archive/master.zip';
        this.addonBoilerplateArchiveName = 'clone-test-master';

        this.addonName = this.options['name'];
        //this.addonName = this.options['productname'];

        this.preferLocalBeta = this.options['beta'];
        this.shouldPlaceAddonDirectly = this.options['place-directly'];
        this.shouldSymlinkAddon = !this.options['do-not-symlink'] && !this.shouldPlaceAddonDirectly;
        this.shouldEnableAddon = !this.options['disable'] && (this.shouldPlaceAddonDirectly || this.shouldSymlinkAddon);
    }

    // PRIVATE METHODS

    async _promptUser(promptProperties) {
        promptProperties.name = 'userResponse';
        const response = await this.prompt(promptProperties);
        return response.userResponse;
    }

    _info(message) {
        this.log('\n' + chalk.yellow('🔈 INFO: ') + message);
    }

    _completion(message) {
        this.log('\n' + chalk.green('✅ DONE: ') + message);
    }

    _warn(message) {
        this.log('\n' + chalk.red('🚨 WARNING: ') + message);
    }

    _error(message) {
        this.env.error('\n' + chalk.red('❌ ERROR: ') + message);
    }

    // ORDERED GENERATOR STEPS

    initializing() {
        // print greeting, instructions, etc
        this.log(ascii);
        this.log(chalk.bgGreen.white.bold('                                LOCAL ADDON CREATOR                                \n'));
        // check existing Local installations
        this.log('\n' + chalk.yellow('🔈 INFO: ') + 'Checking on your existing Local installations and add-ons...');
        const localInstallations = confirmLocalInstallations();
        if(this.preferLocalBeta && localInstallations.has(apps.localBeta)) {
            this.localApp = apps.localBeta;
        } else if(localInstallations.has(apps.local)) {
            this.localApp = apps.local;
        } else if(localInstallations.has(apps.localBeta)) {
            this.localApp = apps.localBeta;
        } else {
            this._error('No installations of Local found! Please install Local at https://localwp.com to create an add-on.');
        }
        // check existing Local add-ons
        try {
            this.existingAddons = confirmExistingLocalAddons(this.localApp);
        } catch(error) {
            this._warn('There was a problem identifying your existing Local add-ons.');
            this.existingAddons = new Set();
        }
        this._completion('Everything looks good! Let\'s start making that new add-on...');
    }

    async prompting() {
        this.log('\n' + chalk.cyan('🎤 PROMPTS: ') + 'We need a bit of information before we can create your add-on.');
        // get addon name (if needed)
        if(this.addonName === undefined) {
            this.addonName = await this._promptUser({
                type: 'input',
                message: 'What is the name of your addon?',
                default: 'my-new-local-addon'
            });
        }
        // confirm name availability
        while(this.existingAddons.has(this.addonName)) {
            this.addonName = await this._promptUser({
                type: 'input',
                message: 'An add-on with the provided name already exists. What is the name of your addon?',
                default: 'my-new-local-addon'
            });
        }

        // Coud prompt here for:
        //  - this.shouldEnableAddon
        //  - this.shouldSymlinkAddon
    }

    async writing() {
        this._info('Pulling down the boilerplate Local add-on to set up...');
        // if symlink flag is not used, create add-on directly in Local add-ons directory
        if(this.shouldPlaceAddonDirectly) {
            this.destinationRoot(getLocalDirectory(this.localApp) + '/addons');
        }

        const archive = fs.createWriteStream('./boilerplate.zip');

        try {
            // pull down boilerplate zip archive
            const response = await fetch(this.addonBoilerplate);
            response.body.pipe(archive);
            
        } catch(error) {
            this._error('There was a problem retrieving the Local add-on boilerplate archive.');
        }

        const readStream = fs.createReadStream(this.destinationRoot() + '/boilerplate.zip')
            .on('error', (error) => {
                // remove boilerplate zip archive
                fs.unlinkSync(this.destinationRoot() + '/boilerplate.zip');
                this._error('There was a problem locating the Local add-on boilerplate archive to be unpacked.');
            });

        try {
            // unzip boilerplate archive
            await readStream.pipe(unzipper.Extract({ path: this.destinationRoot() })).promise();
        } catch (error) {
            // remove boilerplate zip archive
            fs.unlinkSync(this.destinationRoot() + '/boilerplate.zip');
            this._error('There was a problem unpacking the Local add-on boilerplate archive.');
        }

        // remove boilerplate zip archive
        fs.unlinkSync(this.destinationRoot() + '/boilerplate.zip');
        
        try {
            // rename addon folder
            fs.renameSync(this.destinationRoot() + '/' + this.addonBoilerplateArchiveName, this.destinationRoot() + '/' + this.addonName);
        } catch(error) {
            // remove unpacked boilerplate archive
            removeDirectory(this.destinationRoot() + '/' + this.addonBoilerplateArchiveName);
            this._error('There was a problem setting up the Local add-on directory.');
        }

        this._completion('Success! Your Local add-on directory has been created.');
    }

    install() {
        this._info('Setting up your new add-on in the Local application...');
        // symlink new addon (if needed)
        if(this.shouldSymlinkAddon) {
            fs.symlinkSync(this.destinationRoot() + '/' + this.addonName, getLocalDirectory(this.localApp) + '/addons/' + this.addonName);
        }
        // enable addon (if needed)
        if(this.shouldEnableAddon) {
            this._info('Enabling your add-on...');
            enableAddon(this.localApp, this.addonName);
        }
    }

    end() {
        // clean up as needed
        // confirm success/failure
        this._completion('Your ' + this.localApp + ' add-on has been created and set up successfully.');
        this._info('You can find the directory for your newly created add-on at ' + this.destinationRoot() + '/' + this.addonName);
        // print next steps, links, etc
    }
}

module.exports = LocalAddonGenerator;