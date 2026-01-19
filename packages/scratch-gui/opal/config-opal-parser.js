const configOpalParser = {};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = configOpalParser;
} else {
    Opal.load('opal-parser');
    Opal.load('parser');
    Opal.load('parser/ruby31');
    Opal.Parser.CurrentRuby = Opal.Parser.Ruby31;
}
