import React from 'react';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import bindAll from 'lodash.bindall';

import MeshDomainModalComponent from '../components/mesh-domain-modal/mesh-domain-modal.jsx';
import {closeMeshDomainModal} from '../reducers/modals';
import {setDomain} from '../reducers/mesh-v2';

class MeshDomainModal extends React.Component {
    constructor (props) {
        super(props);
        bindAll(this, [
            'handleSave'
        ]);
    }

    handleSave (domain) {
        const extension = this.props.vm.runtime.peripheralExtensions.meshV2;
        if (extension) {
            const error = extension.setDomain(domain);
            if (error) {
                alert(error); // eslint-disable-line no-alert
                return;
            }
            this.props.onSave(domain);
        }
        this.props.onRequestClose();
    }

    render () {
        return (
            <MeshDomainModalComponent
                initialDomain={this.props.domain}
                onRequestClose={this.props.onRequestClose}
                onSave={this.handleSave}
            />
        );
    }
}

MeshDomainModal.propTypes = {
    domain: PropTypes.string,
    onRequestClose: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    vm: PropTypes.shape({
        runtime: PropTypes.shape({
            peripheralExtensions: PropTypes.shape({
                meshV2: PropTypes.shape({
                    setDomain: PropTypes.func
                })
            })
        })
    })
};

const mapStateToProps = state => ({
    domain: state.scratchGui.meshV2.domain,
    vm: state.scratchGui.vm
});

const mapDispatchToProps = dispatch => ({
    onRequestClose: () => dispatch(closeMeshDomainModal()),
    onSave: domain => dispatch(setDomain(domain))
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(MeshDomainModal);
