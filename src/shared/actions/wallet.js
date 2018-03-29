import takeRight from 'lodash/takeRight';
import { iota } from '../libs/iota';
import { updateAddresses, updateAccountAfterTransition } from '../actions/accounts';
import { generateAlert, generateTransitionErrorAlert } from '../actions/alerts';
import { getNewAddress, formatAddresses, syncAddresses, getLatestAddress } from '../libs/iota/addresses';
import { MAX_SEED_LENGTH } from '../libs/iota/utils';
import { DEFAULT_MIN_WEIGHT_MAGNITUDE, DEFAULT_DEPTH } from '../config';
import i18next from '../i18next';

const { t } = i18next.t;

export const ActionTypes = {
    GENERATE_NEW_ADDRESS_REQUEST: 'IOTA/WALLET/GENERATE_NEW_ADDRESS_REQUEST',
    GENERATE_NEW_ADDRESS_SUCCESS: 'IOTA/WALLET/GENERATE_NEW_ADDRESS_SUCCESS',
    GENERATE_NEW_ADDRESS_ERROR: 'IOTA/WALLET/GENERATE_NEW_ADDRESS_ERROR',
    SET_COPIED_TO_CLIPBOARD: 'IOTA/WALLET/SET_COPIED_TO_CLIPBOARD',
    SET_RECEIVE_ADDRESS: 'IOTA/WALLET/SET_RECEIVE_ADDRESS',
    SET_ACCOUNT_NAME: 'IOTA/WALLET/SET_ACCOUNT_NAME',
    SET_PASSWORD: 'IOTA/WALLET/SET_PASSWORD',
    CLEAR_WALLET_DATA: 'IOTA/WALLET/CLEAR_WALLET_DATA',
    SET_USED_SEED_TO_LOGIN: 'IOTA/WALLET/SET_USED_SEED_TO_LOGIN',
    SET_SEED_INDEX: 'IOTA/WALLET/SET_SEED_INDEX',
    SET_READY: 'IOTA/WALLET/SET_READY',
    SET_SEED: 'IOTA/WALLET/SET_SEED',
    CLEAR_SEED: 'IOTA/WALLET/CLEAR_SEED',
    SET_SETTING: 'IOTA/WALLET/SET_SETTING',
    SET_ADDITIONAL_ACCOUNT_INFO: 'IOTA/WALLET/SET_ADDITIONAL_ACCOUNT_INFO',
    SNAPSHOT_TRANSITION_REQUEST: 'IOTA/WALLET/SNAPSHOT_TRANSITION_REQUEST',
    SNAPSHOT_TRANSITION_SUCCESS: 'IOTA/WALLET/SNAPSHOT_TRANSITION_SUCCESS',
    SNAPSHOT_TRANSITION_ERROR: 'IOTA/WALLET/SNAPSHOT_TRANSITION_ERROR',
    SNAPSHOT_ATTACH_TO_TANGLE_REQUEST: 'IOTA/WALLET/SNAPSHOT_ATTACH_TO_TANGLE_REQUEST',
    SNAPSHOT_ATTACH_TO_TANGLE_COMPLETE: 'IOTA/WALLET/SNAPSHOT_ATTACH_TO_TANGLE_COMPLETE',
    UPDATE_TRANSITION_BALANCE: 'IOTA/WALLET/UPDATE_TRANSITION_BALANCE',
    UPDATE_TRANSITION_ADDRESSES: 'IOTA/WALLET/UPDATE_TRANSITION_ADDRESSES',
    SWITCH_BALANCE_CHECK_TOGGLE: 'IOTA/WALLET/SWITCH_BALANCE_CHECK_TOGGLE',
};

export const generateNewAddressRequest = () => ({
    type: ActionTypes.GENERATE_NEW_ADDRESS_REQUEST,
});

export const generateNewAddressSuccess = (payload) => ({
    type: ActionTypes.GENERATE_NEW_ADDRESS_SUCCESS,
    payload,
});

export const generateNewAddressError = () => ({
    type: ActionTypes.GENERATE_NEW_ADDRESS_ERROR,
});

export const setCopiedToClipboard = (payload) => ({
    type: ActionTypes.SET_COPIED_TO_CLIPBOARD,
    payload,
});

export const setReceiveAddress = (payload) => ({
    type: ActionTypes.SET_RECEIVE_ADDRESS,
    payload,
});

export const setAccountName = (payload) => ({
    type: ActionTypes.SET_ACCOUNT_NAME,
    payload,
});

export const setPassword = (payload) => ({
    type: ActionTypes.SET_PASSWORD,
    payload,
});

export const clearWalletData = () => ({
    type: ActionTypes.CLEAR_WALLET_DATA,
});

export const setUsedSeedToLogin = () => ({
    type: ActionTypes.SET_USED_SEED_TO_LOGIN,
    payload: true,
});

export const setSeedIndex = (payload) => ({
    type: ActionTypes.SET_SEED_INDEX,
    payload,
});

export const setReady = () => ({
    type: ActionTypes.SET_READY,
    payload: true,
});

export const setSeed = (payload) => ({
    type: ActionTypes.SET_SEED,
    payload,
});

export const clearSeed = () => ({
    type: ActionTypes.CLEAR_SEED,
    payload: Array(82).join(' '),
});

export const setSetting = (payload) => ({
    type: ActionTypes.SET_SETTING,
    payload,
});

export const setAdditionalAccountInfo = (payload) => ({
    type: ActionTypes.SET_ADDITIONAL_ACCOUNT_INFO,
    payload,
});

export const snapshotTransitionRequest = () => ({
    type: ActionTypes.SNAPSHOT_TRANSITION_REQUEST,
});

export const snapshotTransitionSuccess = (payload) => ({
    type: ActionTypes.SNAPSHOT_TRANSITION_SUCCESS,
    payload,
});

export const snapshotTransitionError = () => ({
    type: ActionTypes.SNAPSHOT_TRANSITION_ERROR,
});

export const snapshotAttachToTangleRequest = (payload) => ({
    type: ActionTypes.SNAPSHOT_ATTACH_TO_TANGLE_REQUEST,
    payload,
});

export const snapshotAttachToTangleComplete = () => ({
    type: ActionTypes.SNAPSHOT_ATTACH_TO_TANGLE_COMPLETE,
});

export const updateTransitionBalance = (payload) => ({
    type: ActionTypes.UPDATE_TRANSITION_BALANCE,
    payload,
});

export const updateTransitionAddresses = (payload) => ({
    type: ActionTypes.UPDATE_TRANSITION_ADDRESSES,
    payload,
});

export const switchBalanceCheckToggle = () => ({
    type: ActionTypes.SWITCH_BALANCE_CHECK_TOGGLE,
});

export const generateNewAddress = (seed, accountName, existingAccountData, genFn) => {
    return (dispatch) => {
        dispatch(generateNewAddressRequest());
        return syncAddresses(seed, existingAccountData, genFn, true)
            .then((newAccountData) => {
                const receiveAddress = iota.utils.addChecksum(getLatestAddress(newAccountData.addresses));
                dispatch(updateAddresses(accountName, newAccountData.addresses));
                dispatch(generateNewAddressSuccess(receiveAddress));
            })
            .catch(() => dispatch(generateNewAddressError()));
    };
};

export const randomiseSeed = (randomBytesFn) => {
    return (dispatch) => {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ9';
        let seed = '';
        randomBytesFn(100).then((bytes) => {
            Object.keys(bytes).forEach((key) => {
                if (bytes[key] < 243 && seed.length < MAX_SEED_LENGTH) {
                    const randomNumber = bytes[key] % 27;
                    const randomLetter = charset.charAt(randomNumber);
                    seed += randomLetter;
                }
            });
            dispatch(setSeed(seed));
        });
    };
};

export const transitionForSnapshot = (seed, addresses, genFn) => {
    return (dispatch) => {
        dispatch(snapshotTransitionRequest());
        if (addresses.length > 0) {
            dispatch(getBalanceForCheck(addresses));
            dispatch(updateTransitionAddresses(addresses));
        } else {
            setTimeout(() => {
                dispatch(generateAddressesAndGetBalance(seed, 0, genFn));
            });
        }
    };
};

export const completeSnapshotTransition = (seed, accountName, addresses) => {
    return (dispatch) => {
        iota.api.getBalances(addresses, 1, (error, success) => {
            if (!error) {
                const allBalances = success.balances.map((a) => Number(a));
                const balance = allBalances.reduce((a, b) => a + b, 0);
                const lastAddressBalance = takeRight(allBalances.filter((balance) => balance > 0));
                const lastIndexWithBalance = allBalances.lastIndexOf(lastAddressBalance.pop());
                const relevantBalances = allBalances.slice(0, lastIndexWithBalance + 1);
                const relevantAddresses = addresses.slice(0, lastIndexWithBalance + 1);

                if (lastIndexWithBalance === -1) {
                    dispatch(snapshotTransitionError());
                    return dispatch(
                        generateAlert(
                            'error',
                            t('cannotCompleteTransition'),
                            t('cannotCompleteTransitionExplanation'),
                            10000,
                        ),
                    );
                }

                iota.api.wereAddressesSpentFrom(addresses, (error, addressSpendStatus) => {
                    if (!error) {
                        const formattedAddresses = formatAddresses(
                            relevantAddresses,
                            relevantBalances,
                            addressSpendStatus,
                        );
                        const attachToTangleBundle = createAttachToTangleBundle(seed, relevantAddresses);
                        const args = [seed, DEFAULT_DEPTH, DEFAULT_MIN_WEIGHT_MAGNITUDE, attachToTangleBundle];
                        dispatch(snapshotAttachToTangleRequest());
                        iota.api.sendTransfer(...args, (error) => {
                            if (!error) {
                                dispatch(updateAccountAfterTransition(accountName, formattedAddresses, balance));
                                dispatch(snapshotTransitionSuccess());
                                dispatch(snapshotAttachToTangleComplete());
                                dispatch(
                                    generateAlert(
                                        'success',
                                        t('transitionComplete'),
                                        t('transitionCompleteExplanation'),
                                        20000,
                                    ),
                                );
                            } else {
                                dispatch(snapshotTransitionError());
                                dispatch(snapshotAttachToTangleComplete());
                                dispatch(generateTransitionErrorAlert());
                            }
                        });
                    } else {
                        console.log(error);
                    }
                });
            } else {
                dispatch(snapshotTransitionError());
                dispatch(generateTransitionErrorAlert());
            }
        });
    };
};

export const generateAddressesAndGetBalance = (seed, index, genFn) => {
    return (dispatch) => {
        const options = {
            index: index,
            total: 20,
            returnAll: true,
            security: 2,
        };
        getNewAddress(seed, options, genFn, (error, addresses) => {
            if (error) {
                dispatch(snapshotTransitionError());
                dispatch(generateTransitionErrorAlert());
            } else {
                dispatch(updateTransitionAddresses(addresses));
                dispatch(getBalanceForCheck(addresses));
            }
        });
    };
};

export const createAttachToTangleBundle = (seed, addresses) => {
    const transfers = [];
    for (let i = 0; i < addresses.length; i++) {
        transfers.push({
            address: addresses[i],
            value: 0,
        });
    }
    return transfers;
};

export const getBalanceForCheck = (addresses) => {
    return (dispatch) => {
        iota.api.getBalances(addresses, 1, (error, success) => {
            if (!error) {
                const balances = success.balances.map((a) => Number(a));
                const balance = balances.reduce((a, b) => a + b, 0);
                dispatch(updateTransitionBalance(balance));
                dispatch(switchBalanceCheckToggle());
            } else {
                dispatch(snapshotTransitionError());
                dispatch(generateTransitionErrorAlert());
            }
        });
    };
};
