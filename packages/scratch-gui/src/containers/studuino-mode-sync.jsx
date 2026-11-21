// Studuino モードの設定を VM から redux へ写すコンテナ（#2213）。何も描かない。
//   - 設定の正は VM の runtime.extensionStorage（#2212）。変わったとき（STUDUINO_SETTINGS_CHANGED）と、
//     作品を読みこんだとき（PROJECT_LOADED。新規も含む）に読み直す。
//   - 読みこんだ作品が Studuino モードなのにアーテックロボの拡張機能を読みこんでいないときは読みこむ
//     （拡張機能のメニューが出ないと、モードから出られないため）。
import {
    getStuduinoSettings,
    setStuduinoSettings,
    STUDUINO_SETTINGS_CHANGED,
} from '@smalruby/scratch-vm/src/extensions/scratch3_smalrubot_s1/studuino-settings';
import PropTypes from 'prop-types';
import { useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import log from '../lib/log';
import { isStuduinoModeSettings, STUDUINO_EXTENSION_ID } from '../lib/studuino-mode';
import {
    getStuduinoPendingSettings,
    openStuduinoPortSettings,
    setStuduinoModeSettings,
    setStuduinoPendingSettings,
} from '../reducers/studuino-mode';

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

const StuduinoModeSync = ({ onSettings, onPendingApplied, pendingSettings, vm }) => {
    // 「すべて消して切り替える」（#2214）: 新規の作品を読みこんだら、覚えておいた設定（ポート・動かし方）を入れる
    const pendingRef = useRef(pendingSettings);
    pendingRef.current = pendingSettings;
    useEffect(() => {
        if (!vm || !vm.runtime) return () => {};
        const sync = () => {
            const settings = getStuduinoSettings(vm.runtime);
            onSettings(settings);
            return settings;
        };
        const handleLoaded = () => {
            const pending = pendingRef.current;
            if (pending) {
                setStuduinoSettings(vm.runtime, pending);
                onPendingApplied(isStuduinoModeSettings(pending));
            }
            ensureExtensionLoaded(vm, sync());
        };
        sync();
        vm.runtime.on(STUDUINO_SETTINGS_CHANGED, sync);
        vm.runtime.on(PROJECT_LOADED, handleLoaded);
        return () => {
            vm.runtime.removeListener(STUDUINO_SETTINGS_CHANGED, sync);
            vm.runtime.removeListener(PROJECT_LOADED, handleLoaded);
        };
    }, [vm, onSettings, onPendingApplied]);
    return null;
};

StuduinoModeSync.propTypes = {
    onPendingApplied: PropTypes.func.isRequired,
    onSettings: PropTypes.func.isRequired,
    pendingSettings: PropTypes.object,
    vm: PropTypes.shape({
        extensionManager: PropTypes.object,
        runtime: PropTypes.object,
    }),
};

const mapStateToProps = (state) => ({
    pendingSettings: getStuduinoPendingSettings(state),
    vm: state.scratchGui.vm,
});

const mapDispatchToProps = (dispatch) => ({
    onSettings: (settings) => dispatch(setStuduinoModeSettings(settings)),
    onPendingApplied: (entered) => {
        dispatch(setStuduinoPendingSettings(null));
        // Studuino モードに入った直後は入出力の設定を 1 回開く（S4）
        if (entered) dispatch(openStuduinoPortSettings());
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(StuduinoModeSync);
