// The converter for "nothing to convert": its own module so the main bundle can use it without
// pulling the converter (in the Ruby bundle, `ruby-bundle.js`) back in.
const NullRubyToBlocksConverter = {
    result: true,
    errors: [],
    apply: () => Promise.resolve(),
};

export default NullRubyToBlocksConverter;
