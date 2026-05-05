import PropTypes from 'prop-types';
import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import { applyStorageWorkerTimeout } from './storage-worker-timeout.js';

/**
 * `vm.runtime.storage` が用意できしだい、FetchWorkerTool への timeout patch
 * を当てる HOC。サブディレクトリ deploy + iOS Safari で Web Worker 内
 * `fetch()` が無限にハングする問題への対策 (詳細は storage-worker-timeout.js)。
 *
 * VM は AppStateHOC が Redux store にセットアップする。VM の constructor で
 * すでに storage が作られているはずだが、安全のため 250ms 周期で 10 秒間
 * polling し、storage が見えたら一度だけ patch する。
 * @param {React.ComponentType} WrappedComponent - ラップ対象 (通常 ResponsiveGui)
 * @returns {React.ComponentType} HOC でラップされたコンポーネント
 */
const StorageWorkerTimeoutHOC = (WrappedComponent) => {
    const Wrapped = ({ vm, ...rest }) => {
        useEffect(() => {
            if (!vm) return () => {};
            const tryApply = () => {
                const storage = vm.runtime?.storage;
                return Boolean(storage && applyStorageWorkerTimeout(storage));
            };
            if (tryApply()) return () => {};
            let attempts = 0;
            const interval = setInterval(() => {
                if (tryApply() || ++attempts > 40) clearInterval(interval);
            }, 250);
            return () => clearInterval(interval);
        }, [vm]);
        return <WrappedComponent vm={vm} {...rest} />;
    };
    Wrapped.propTypes = {
        vm: PropTypes.object,
    };
    Wrapped.displayName = `StorageWorkerTimeoutHOC(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
    return connect((state) => ({ vm: state.scratchGui.vm }))(Wrapped);
};

export default StorageWorkerTimeoutHOC;
