import BoostConverter from './boost';
import ControlConverter from './control';
import EV3Converter from './ev3';
import EventConverter from './event';
import FaceSensingConverter from './face_sensing';
// === Smalruby: End of TM2Scratch extension ===
// === Smalruby: Start of G2S (AkaDako) extension ===
import G2SConverter from './g2s';
import GdxForConverter from './gdx_for';
import KoshienConverter from './koshien';
import LooksConverter from './looks';
import MakeyMakeyConverter from './makeymakey';
import MeshConverter from './mesh';
import MeshV2Converter from './mesh_v2';
import MicroBitConverter from './microbit';
import MicrobitMoreConverter from './microbit_more';
import MotionConverter from './motion';
import MusicConverter from './music';
import MyBlocksConverter from './my-blocks';
import OperatorsConverter from './operators';
import PenConverter from './pen';
import SensingConverter from './sensing';
import SmalrubotS1Converter from './smalrubot_s1';
// === Smalruby: End of G2S (AkaDako) extension ===
// === Smalruby: Start of Ruby String extension ===
import SmalrubyRubyConverter from './smalruby-ruby';
import SoundConverter from './sound';
import Text2SpeechConverter from './text2speech';
// === Smalruby: Start of TM2Scratch extension ===
import TM2ScratchConverter from './tm2scratch';
import TranslateConverter from './translate';
import VariablesConverter from './variables';
import VideoConverter from './video';
import Wedo2Converter from './wedo2';

// === Smalruby: End of Ruby String extension ===

const registerConverters = function (converter) {
    [
        VariablesConverter,
        EventConverter,
        ControlConverter,
        MicroBitConverter,
        VideoConverter,
        Text2SpeechConverter,
        Wedo2Converter,
        MicrobitMoreConverter,
        MeshV2Converter,
        MeshConverter,
        KoshienConverter,
        FaceSensingConverter,
        TM2ScratchConverter,
        G2SConverter,
        SmalrubyRubyConverter,
        BoostConverter,
        TranslateConverter,
        SoundConverter,
        MusicConverter,
        PenConverter,
        MakeyMakeyConverter,
        OperatorsConverter,
        LooksConverter,
        EV3Converter,
        GdxForConverter,
        SmalrubotS1Converter,
        MotionConverter,
        SensingConverter,
        MyBlocksConverter,
    ].forEach((x) => x.register(converter));
};

export {
    registerConverters as default,
    MusicConverter,
    PenConverter,
    EV3Converter,
    GdxForConverter,
    SmalrubotS1Converter,
    BoostConverter,
    TranslateConverter,
    MakeyMakeyConverter,
    LooksConverter,
    SoundConverter,
    SensingConverter,
};
