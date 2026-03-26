use magnus::{function, prelude::*, Error, RString, Ruby};
use std::fs;

/// Convert an SVG file to a PNG file.
/// Returns true on success, raises on error.
fn convert_file(svg_path: String, png_path: String) -> Result<bool, Error> {
    let svg_data = fs::read(&svg_path).map_err(|e| {
        Error::new(
            magnus::exception::runtime_error(),
            format!("Failed to read SVG file '{}': {}", svg_path, e),
        )
    })?;

    let png_data = render_svg(&svg_data).map_err(|e| {
        Error::new(
            magnus::exception::runtime_error(),
            format!("Failed to render SVG: {}", e),
        )
    })?;

    fs::write(&png_path, &png_data).map_err(|e| {
        Error::new(
            magnus::exception::runtime_error(),
            format!("Failed to write PNG file '{}': {}", png_path, e),
        )
    })?;

    Ok(true)
}

/// Convert SVG bytes (Ruby String) to PNG bytes (Ruby String).
fn convert_bytes(svg_data: RString) -> Result<RString, Error> {
    // Safety: we only read the string bytes within this block
    let png_data = unsafe {
        let bytes = svg_data.as_slice();
        render_svg(bytes).map_err(|e| {
            Error::new(
                magnus::exception::runtime_error(),
                format!("Failed to render SVG: {}", e),
            )
        })?
    };

    Ok(RString::from_slice(&png_data))
}

/// Encode RGBA pixel data to a PNG file.
/// rgba_data: Ruby String containing raw RGBA bytes (4 bytes per pixel)
/// width, height: image dimensions
/// png_path: output file path
fn save_png(rgba_data: RString, width: u32, height: u32, png_path: String) -> Result<bool, Error> {
    unsafe {
        let bytes = rgba_data.as_slice();
        let expected = (width as usize) * (height as usize) * 4;
        if bytes.len() != expected {
            return Err(Error::new(
                magnus::exception::arg_error(),
                format!(
                    "RGBA data size mismatch: expected {} bytes ({}x{}x4), got {}",
                    expected, width, height, bytes.len()
                ),
            ));
        }
        encode_rgba_png(bytes, width, height, &png_path).map_err(|e| {
            Error::new(
                magnus::exception::runtime_error(),
                format!("Failed to save PNG '{}': {}", png_path, e),
            )
        })?;
    }
    Ok(true)
}

fn encode_rgba_png(rgba: &[u8], width: u32, height: u32, path: &str) -> Result<(), String> {
    let file =
        std::fs::File::create(path).map_err(|e| format!("Failed to create file: {}", e))?;
    let w = std::io::BufWriter::new(file);
    let mut encoder = png::Encoder::new(w, width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder
        .write_header()
        .map_err(|e| format!("PNG header error: {}", e))?;
    writer
        .write_image_data(rgba)
        .map_err(|e| format!("PNG write error: {}", e))?;
    Ok(())
}

fn render_svg(svg_data: &[u8]) -> Result<Vec<u8>, String> {
    let opt = usvg::Options::default();
    let tree =
        usvg::Tree::from_data(svg_data, &opt).map_err(|e| format!("SVG parse error: {}", e))?;

    let size = tree.size().to_int_size();
    let mut pixmap = tiny_skia::Pixmap::new(size.width(), size.height())
        .ok_or_else(|| "Failed to create pixmap (invalid dimensions)".to_string())?;

    resvg::render(&tree, tiny_skia::Transform::default(), &mut pixmap.as_mut());

    pixmap
        .encode_png()
        .map_err(|e| format!("PNG encode error: {}", e))
}

#[magnus::init]
fn init(ruby: &Ruby) -> Result<(), Error> {
    let module = ruby.define_module("Smalruby3")?;
    let resvg = module.define_module("Resvg")?;
    resvg.define_singleton_method("convert_file", function!(convert_file, 2))?;
    resvg.define_singleton_method("convert_bytes", function!(convert_bytes, 1))?;
    resvg.define_singleton_method("save_png", function!(save_png, 4))?;
    Ok(())
}
