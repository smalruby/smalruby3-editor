const configOpal = {
    unsupported_features_severity: 'ignore'
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = configOpal;
} else {
    Opal.config.unsupported_features_severity = configOpal.unsupported_features_severity;
}
