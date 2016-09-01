'use strict';

angular.module('copayApp.controllers').controller('importController',
  function($scope, $rootScope, $timeout, $log, $state, $stateParams, $ionicHistory, profileService, configService, sjcl, gettext, ledger, trezor, derivationPathHelper, platformInfo, bwcService, ongoingProcess, walletService, popupService, gettextCatalog) {

    var isChromeApp = platformInfo.isChromeApp;
    var isDevel = platformInfo.isDevel;
    var reader = new FileReader();
    var defaults = configService.getDefaults();
    var errors = bwcService.getErrors();
    $scope.isSafari = platformInfo.isSafari;
    $scope.isCordova = platformInfo.isCordova;
    $scope.bwsurl = defaults.bws.url;
    $scope.derivationPath = derivationPathHelper.default;
    $scope.account = 1;
    $scope.importErr = false;

    var updateSeedSourceSelect = function() {
      $scope.seedOptions = [];

      if (isChromeApp) {
        $scope.seedOptions.push({
          id: 'ledger',
          label: 'Ledger Hardware Wallet',
        });
      }

      if (isChromeApp || isDevel) {
        $scope.seedOptions.push({
          id: 'trezor',
          label: 'Trezor Hardware Wallet',
        });
        $scope.seedSource = $scope.seedOptions[0];
      }
    };

    $scope.processWalletInfo = function(code) {
      if (!code) return;

      $scope.importErr = false;
      var parsedCode = code.split('|');

      if (parsedCode.length != 5) {
        /// Trying to import a malformed wallet export QR code
        popupService.showAlert(gettextCatalog.getString('Error'), gettextCatalog.getString('Incorrect code format'));
        return;
      }

      var info = {
        type: parsedCode[0],
        data: parsedCode[1],
        network: parsedCode[2],
        derivationPath: parsedCode[3],
        hasPassphrase: parsedCode[4] == 'true' ? true : false
      };

      if (info.type == 1 && info.hasPassphrase)
        popupService.showAlert(gettextCatalog.getString('Password required. Make sure to enter your password in advanced options'));

      $scope.derivationPath = info.derivationPath;
      $scope.testnetEnabled = info.network == 'testnet' ? true : false;

      $timeout(function() {
        $scope.words = info.data;
        $rootScope.$apply();
      }, 1);
    };

    $scope.setType = function(type) {
      $scope.type = type;
      $timeout(function() {
        $rootScope.$apply();
      }, 1);
    };

    var _importBlob = function(str, opts) {
      var str2, err;
      try {
        str2 = sjcl.decrypt($scope.password, str);
      } catch (e) {
        err = gettextCatalog.getString('Could not decrypt file, check your password');
        $log.warn(e);
      };

      if (err) {
        popupService.showAlert(gettextCatalog.getString('Error'), err);
        $timeout(function() {
          $rootScope.$apply();
        });
        return;
      }

      ongoingProcess.set('importingWallet', true);
      opts.compressed = null;
      opts.password = null;

      $timeout(function() {
        profileService.importWallet(str2, opts, function(err, client) {
          ongoingProcess.set('importingWallet', false);
          if (err) {
            popupService.showAlert(gettextCatalog.getString('Error'), err);
            return;

          }

          walletService.updateRemotePreferences(client, {}, function() {
            $log.debug('Remote preferences saved for:' + client.credentials.walletId)
          });

          profileService.setBackupFlag(client.credentials.walletId);
          if ($stateParams.fromOnboarding) {
            profileService.setDisclaimerAccepted(function(err) {
              if (err) $log.error(err);
            });
          }
          $state.go('tabs.home');
        });
      }, 100);
    };

    var _importExtendedPrivateKey = function(xPrivKey, opts) {
      ongoingProcess.set('importingWallet', true);
      $timeout(function() {
        profileService.importExtendedPrivateKey(xPrivKey, opts, function(err, client) {
          ongoingProcess.set('importingWallet', false);
          if (err) {
            if (err instanceof errors.NOT_AUTHORIZED) {
              $scope.importErr = true;
            } else {
              popupService.showAlert(gettextCatalog.getString('Error'), err);
            }
            return $timeout(function() {
              $scope.$apply();
            });
          }


          walletService.updateRemotePreferences(client, {}, function() {
            $log.debug('Remote preferences saved for:' + client.credentials.walletId)
          });

          profileService.setBackupFlag(client.credentials.walletId);
          if ($stateParams.fromOnboarding) {
            profileService.setDisclaimerAccepted(function(err) {
              if (err) $log.error(err);
            });
          }
          $state.go('tabs.home');
        });
      }, 100);
    };

    /*
      IMPORT FROM PUBLIC KEY - PENDING

    var _importExtendedPublicKey = function(xPubKey, opts) {
      ongoingProcess.set('importingWallet', true);
      $timeout(function() {
        profileService.importExtendedPublicKey(opts, function(err, walletId) {
          ongoingProcess.set('importingWallet', false);
          if (err) {
            $scope.error = err;
            return $timeout(function() {
              $scope.$apply();
            });
          }

          profileService.setBackupFlag(walletId);
          if ($stateParams.fromOnboarding) {
            profileService.setDisclaimerAccepted(function(err) {
              if (err) $log.error(err);
            });
          }
          $state.go('tabs.home');
        });
      }, 100);
    };
    */

    var _importMnemonic = function(words, opts) {
      ongoingProcess.set('importingWallet', true);

      $timeout(function() {
        profileService.importMnemonic(words, opts, function(err, client) {
          ongoingProcess.set('importingWallet', false);

          if (err) {
            if (err instanceof errors.NOT_AUTHORIZED) {
              $scope.importErr = true;
            } else {
              popupService.showAlert(gettextCatalog.getString('Error'), err);
            }
            return $timeout(function() {
              $scope.$apply();
            });
          }

          walletService.updateRemotePreferences(client, {}, function() {
            $log.debug('Remote preferences saved for:' + client.credentials.walletId)
          });

          profileService.setBackupFlag(client.credentials.walletId);
          if ($stateParams.fromOnboarding) {
            profileService.setDisclaimerAccepted(function(err) {
              if (err) $log.error(err);
            });
          }
          $state.go('tabs.home');
        });
      }, 100);
    };

    $scope.setDerivationPath = function(testnetEnabled) {
      if (testnetEnabled)
        $scope.derivationPath = derivationPathHelper.defaultTestnet;
      else
        $scope.derivationPath = derivationPathHelper.default;
    };

    $scope.getFile = function() {
      // If we use onloadend, we need to check the readyState.
      reader.onloadend = function(evt) {
        if (evt.target.readyState == FileReader.DONE) { // DONE == 2
          var opts = {};
          opts.bwsurl = $scope.bwsurl;
          _importBlob(evt.target.result, opts);
        }
      }
    };

    $scope.importBlob = function(form) {
      if (form.$invalid) {
        popupService.showAlert(gettextCatalog.getString('Error'), gettextCatalog.getString('There is an error in the form'));
        return;
      }

      var backupFile = $scope.file;
      var backupText = form.backupText.$modelValue;
      var password = form.password.$modelValue;

      if (!backupFile && !backupText) {
        popupService.showAlert(gettextCatalog.getString('Error'), gettextCatalog.getString('Please, select your backup file'));
        return;
      }

      if (backupFile) {
        reader.readAsBinaryString(backupFile);
      } else {
        var opts = {};
        opts.bwsurl = $scope.bwsurl;
        _importBlob(backupText, opts);
      }
    };

    $scope.importMnemonic = function(form) {
      if (form.$invalid) {
        popupService.showAlert(gettextCatalog.getString('Error'), gettextCatalog.getString('There is an error in the form'));
        return;
      }

      var opts = {};
      if ($scope.bwsurl)
        opts.bwsurl = $scope.bwsurl;

      var pathData = derivationPathHelper.parse($scope.derivationPath);
      if (!pathData) {
        popupService.showAlert(gettextCatalog.getString('Error'), gettextCatalog.getString('Invalid derivation path'));
        return;
      }
      opts.account = pathData.account;
      opts.networkName = pathData.networkName;
      opts.derivationStrategy = pathData.derivationStrategy;

      var words = form.words.$modelValue || null;

      if (!words) {
        popupService.showAlert(gettextCatalog.getString('Please enter the recovery phrase'));
      } else if (words.indexOf('xprv') == 0 || words.indexOf('tprv') == 0) {
        return _importExtendedPrivateKey(words, opts);
      } else if (words.indexOf('xpub') == 0 || words.indexOf('tpuv') == 0) {
        return _importExtendedPublicKey(words, opts);
      } else {
        var wordList = words.split(/[\u3000\s]+/);

        if ((wordList.length % 3) != 0) {
          popupService.showAlert(gettextCatalog.getString('Wrong number of recovery words:') + wordList.length);
          return;
        }
      }

      var passphrase = form.passphrase.$modelValue;
      opts.passphrase = form.passphrase.$modelValue || null;

      _importMnemonic(words, opts);
    };

    $scope.importTrezor = function(account, isMultisig) {
      trezor.getInfoForNewWallet(isMultisig, account, function(err, lopts) {
        ongoingProcess.clear();
        if (err) {
          popupService.showAlert(gettextCatalog.getString('Error'), err);
          return;
        }

        lopts.externalSource = 'trezor';
        lopts.bwsurl = $scope.bwsurl;
        ongoingProcess.set('importingWallet', true);
        $log.debug('Import opts', lopts);

        profileService.importExtendedPublicKey(lopts, function(err, wallet) {
          ongoingProcess.set('importingWallet', false);
          if (err) {
            popupService.showAlert(gettextCatalog.getString('Error'), err);
            return;
          }


          walletService.updateRemotePreferences(wallet, {}, function() {
            $log.debug('Remote preferences saved for:' + wallet.walletId)
          });

          profileService.setBackupFlag(wallet.walletId);
          if ($stateParams.fromOnboarding) {
            profileService.setDisclaimerAccepted(function(err) {
              if (err) $log.error(err);
            });
          }
          $state.go('tabs.home');
        });
      }, 100);
    };

    $scope.importHW = function(form) {
      if (form.$invalid || $scope.account < 0) {
        popupService.showAlert(gettextCatalog.getString('There is an error in the form'));
        return;
      }
      $scope.importErr = false;

      var account = +$scope.account;

      if ($scope.seedSourceId == 'trezor') {
        if (account < 1) {
          $scope.error = gettext('Invalid account number');
          return;
        }
        account = account - 1;
      }

      switch ($scope.seedSourceId) {
        case ('ledger'):
          ongoingProcess.set('connectingledger', true);
          $scope.importLedger(account);
          break;
        case ('trezor'):
          ongoingProcess.set('connectingtrezor', true);
          $scope.importTrezor(account, $scope.isMultisig);
          break;
        default:
          throw ('Error: bad source id');
      };
    };

    $scope.setSeedSource = function() {

      if (!$scope.seedSource) return;
      $scope.seedSourceId = $scope.seedSource.id;
      $timeout(function() {
        $rootScope.$apply();
      });
    };

    $scope.importLedger = function(account) {
      ledger.getInfoForNewWallet(true, account, function(err, lopts) {
        ongoingProcess.clear();
        if (err) {
          popupService.showAlert(gettextCatalog.getString('Error'), err);
          return;
        }

        lopts.externalSource = 'ledger';
        lopts.bwsurl = $scope.bwsurl;
        ongoingProcess.set('importingWallet', true);
        $log.debug('Import opts', lopts);

        profileService.importExtendedPublicKey(lopts, function(err, wallet) {
          ongoingProcess.set('importingWallet', false);
          if (err) {
            popupService.showAlert(gettextCatalog.getString('Error'), err);
            return;
          }


          walletService.updateRemotePreferences(wallet, {}, function() {
            $log.debug('Remote preferences saved for:' + wallet.walletId)
          });

          profileService.setBackupFlag(wallet.walletId);
          if ($stateParams.fromOnboarding) {
            profileService.setDisclaimerAccepted(function(err) {
              if (err) $log.error(err);
            });
          }
          $state.go('tabs.home');
        });
      }, 100);
    };

    updateSeedSourceSelect();
    $scope.setSeedSource('new');
  });
