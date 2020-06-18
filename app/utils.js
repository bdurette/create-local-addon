const fs = require('fs');
const os = require('os');

const platforms = {
    macOS: 'darwin',
    windows: 'win32',
    linux: 'linux'
};

const apps = {
    local: 'Local',
    localBeta: 'Local Beta'
};

const removeDirectory = function(path) {
    if(!fs.existsSync(path))
        return;
    if(fs.lstatSync(path).isFile()) {
        fs.unlinkSync(path);
        return;
    }
    fs.readdirSync(path).forEach((member) => {
        if(fs.lstatSync(path + '/' + member).isDirectory()) {
            removeDirectory(path + '/' + member);
        } else {
            fs.unlinkSync(path + '/' + member);
        }
    });
    fs.rmdirSync(path);
};

const getLocalDirectory = function(localApp) {
    const platform = os.platform();
    if(platform === platforms.macOS) {
        return os.homedir() + '/Library/Application Support/' + localApp;
    }
};

const confirmLocalInstallations = function() {
    var localInstallations = new Set();
    if(fs.existsSync(getLocalDirectory(apps.local))) {
        localInstallations.add(apps.local);
    }
    if(fs.existsSync(getLocalDirectory(apps.localBeta))) {
        localInstallations.add(apps.localBeta);
    }
    return localInstallations;
};

const confirmExistingLocalAddons = function(localApp) {
    var existingAddons = new Set();
    fs.readdirSync(getLocalDirectory(localApp) + '/addons').forEach((addonName) => {
        if(!addonName.startsWith('.')) {
            existingAddons.add(addonName);
        }
    });
    return existingAddons;
};

const enableAddon = function(localApp, addonName) {
    // ...
};

module.exports = {
    platforms,
    apps,
    removeDirectory,
    getLocalDirectory,
    confirmLocalInstallations,
    confirmExistingLocalAddons,
    enableAddon
};