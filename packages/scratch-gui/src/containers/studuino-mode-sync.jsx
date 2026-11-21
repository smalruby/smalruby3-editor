// Studuino モードの設定を VM から redux へ写すコンテナ（#2213）。何も描かない。
//   - 設定の正は VM の runtime.extensionStorage（#2212）。変わったとき（STUDUINO_SETTINGS_CHANGED）と、
//     作品を読みこんだとき（PROJECT_LOADED。新規も含む）に読み直す。
//   - 読みこんだ作品が Studuino モードなのにアーテックロボの拡張機能を読みこんでいないときは読みこむ
//     （拡張機能のメニューが出ないと、モードから出られないため）。
import {
    getStuduinoSettings,
    STUDUINO_SETTINGS_CHANGED,
} from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';
import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { connect } from 'react-redux';
import log from '../lib/log';
import { isStuduinoModeSettings, STUDUINO_EXTENSION_ID } from '../lib/studuino-mode';
import { setStuduinoModeSettings } from '../reducers/studuino-mode';

const PROJECT_LOADED = 'PROJECT_LOADED';

/**
 * Studuino モードなのに拡張機能が無ければ読みこむ。
 * @param {object} vm - VM。
 * @param {object} settings - 設定。
 */
const ensureExtensionLoaded = (vm, settings) => {
    if (!isStuduinoModeSettings(settings)) return;
    const manager = vm.extensionManager;
    if (!manager || manager.isExtensionLoaded(STUDUINO_EXTENSION_ID)) return;
    Promise.resolve(manager.loadExtensionURL(STUDUINO_EXTENSION_ID)).catch((e) => {
        log.error('Failed to load the Studuino extension:', e);
    });
};

const StuduinoModeSync = ({ onSettings, vm }) => {
    useEffect(() => {
        if (!vm || !vm.runtime) return () => {};
        const sync = () => {
            const settings = getStuduinoSettings(vm.runtime);
            onSettings(settings);
            return settings;
        };
        const handleLoaded = () => ensureExtensionLoaded(vm, sync());
        sync();
        vm.runtime.on(STUDUINO_SETTINGS_CHANGED, sync);
        vm.runtime.on(PROJECT_LOADED, handleLoaded);
        return () => {
            vm.runtime.removeListener(STUDUINO_SETTINGS_CHANGED, sync);
            vm.runtime.removeListener(PROJECT_LOADED, handleLoaded);
        };
    }, [vm, onSettings]);
    return null;
};

StuduinoModeSync.propTypes = {
    onSettings: PropTypes.func.isRequired,
    vm: PropTypes.shape({
        extensionManager: PropTypes.object,
        runtime: PropTypes.object,
    }),
};

const mapStateToProps = (state) => ({ vm: state.scratchGui.vm });

const mapDispatchToProps = (dispatch) => ({
    onSettings: (settings) => dispatch(setStuduinoModeSettings(settings)),
});

export default connect(mapStateToProps, mapDispatchToProps)(StuduinoModeSync);
