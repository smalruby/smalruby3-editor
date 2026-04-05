import React, { useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import SmalrubotFirmwareModalComponent from '../components/smalrubot-firmware-modal/smalrubot-firmware-modal.jsx';
import { FirmwareFlasher, isMacOS } from '../lib/smalrubot-firmware-flasher';
import { closeSmalrubotFirmwareModal } from '../reducers/smalrubot-firmware';

const SmalrubotFirmwareModal = () => {
    const dispatch = useDispatch();
    const [phase, setPhase] = useState(isMacOS() ? 'macSetup' : 'ready');
    const [progressPercent, setProgressPercent] = useState(0);
    const [statusMessage, setStatusMessage] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);

    const handleFlash = useCallback(() => {
        setPhase('flashing');
        setProgressPercent(0);
        setStatusMessage(null);
        setErrorMessage(null);

        const flasher = new FirmwareFlasher({ debug: true });

        flasher
            .flashDefaultFirmware(
                (written, total) => {
                    setProgressPercent(Math.floor((written / total) * 200) / 2);
                },
                msg => {
                    setStatusMessage(msg);
                },
            )
            .then(() => {
                setPhase('success');
            })
            .catch(err => {
                setPhase('error');
                setErrorMessage(err.message || String(err));
            });
    }, []);

    const handleClose = useCallback(() => {
        setPhase(isMacOS() ? 'macSetup' : 'ready');
        setProgressPercent(0);
        setStatusMessage(null);
        setErrorMessage(null);
        dispatch(closeSmalrubotFirmwareModal());
    }, [dispatch]);

    const handleProceedToReady = useCallback(() => {
        setPhase('ready');
    }, []);

    return (
        <SmalrubotFirmwareModalComponent
            errorMessage={errorMessage}
            phase={phase}
            progressPercent={progressPercent}
            statusMessage={statusMessage}
            onClose={handleClose}
            onFlash={handleFlash}
            onProceedToReady={handleProceedToReady}
        />
    );
};

export default SmalrubotFirmwareModal;
