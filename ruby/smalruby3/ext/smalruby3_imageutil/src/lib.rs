//! Smalruby3 ImageUtil — Rust native extension for image processing.
//!
//! Provides `Smalruby3::ImageUtil` Ruby module with:
//! - `convert_svg_to_png(svg_path, png_path)` — SVG file to PNG file conversion
//! - `svg_to_png_bytes(svg_data)` — SVG bytes to PNG bytes (in-memory)
//! - `save_png(rgba_data, width, height, png_path)` — raw RGBA pixels to PNG file
//!
//! SVG rendering is powered by [resvg](https://github.com/linebender/resvg)
//! (dual-licensed Apache-2.0/MIT). PNG encoding uses the `png` crate.

use magnus::{function, prelude::*, Error, RString, Ruby};
use std::fs;
use std::io::Write;

/// Convert an SVG file to a PNG file.
/// Writes to a temp file first, then renames for atomic write.
fn convert_file(ruby: &Ruby, svg_path: String, png_path: String) -> Result<bool, Error> {
    let svg_data = fs::read(&svg_path).map_err(|e| {
        Error::new(
            ruby.exception_runtime_error(),
            format!("Failed to read SVG file '{svg_path}': {e}"),
        )
    })?;

    let png_data = render_svg(&svg_data).map_err(|e| {
        Error::new(
            ruby.exception_runtime_error(),
            format!("Failed to render SVG: {e}"),
        )
    })?;

    write_atomically(&png_path, &png_data).map_err(|e| {
        Error::new(
            ruby.exception_runtime_error(),
            format!("Failed to write PNG file '{png_path}': {e}"),
        )
    })?;

    Ok(true)
}

/// Convert SVG bytes (Ruby String) to PNG bytes (Ruby String).
fn convert_bytes(ruby: &Ruby, svg_data: RString) -> Result<RString, Error> {
    // Copy data out of Ruby heap before calling into render_svg,
    // which allocates and could trigger GC (invalidating the slice).
    let owned: Vec<u8> = unsafe { svg_data.as_slice().to_vec() };
    let png_data = render_svg(&owned).map_err(|e| {
        Error::new(
            ruby.exception_runtime_error(),
            format!("Failed to render SVG: {e}"),
        )
    })?;

    Ok(ruby.str_from_slice(&png_data))
}

/// Encode RGBA pixel data to a PNG file.
/// rgba_data: Ruby String containing raw RGBA bytes (4 bytes per pixel)
/// width, height: image dimensions
/// png_path: output file path
fn save_png(
    ruby: &Ruby,
    rgba_data: RString,
    width: u32,
    height: u32,
    png_path: String,
) -> Result<bool, Error> {
    // Copy data out of Ruby heap before allocating (GC safety).
    let owned: Vec<u8> = unsafe { rgba_data.as_slice().to_vec() };
    let expected = (width as usize) * (height as usize) * 4;
    if owned.len() != expected {
        return Err(Error::new(
            ruby.exception_arg_error(),
            format!(
                "RGBA data size mismatch: expected {expected} bytes ({width}x{height}x4), got {}",
                owned.len()
            ),
        ));
    }
    encode_rgba_png(&owned, width, height, &png_path).map_err(|e| {
        Error::new(
            ruby.exception_runtime_error(),
            format!("Failed to save PNG '{png_path}': {e}"),
        )
    })?;
    Ok(true)
}

fn encode_rgba_png(rgba: &[u8], width: u32, height: u32, path: &str) -> Result<(), String> {
    let file =
        std::fs::File::create(path).map_err(|e| format!("Failed to create file: {e}"))?;
    let w = std::io::BufWriter::new(file);
    let mut encoder = png::Encoder::new(w, width, height);
    encoder.set_color(png::ColorType::Rgba);
    encoder.set_depth(png::BitDepth::Eight);
    let mut writer = encoder
        .write_header()
        .map_err(|e| format!("PNG header error: {e}"))?;
    writer
        .write_image_data(rgba)
        .map_err(|e| format!("PNG write error: {e}"))?;
    Ok(())
}

fn render_svg(svg_data: &[u8]) -> Result<Vec<u8>, String> {
    let opt = usvg::Options::default();
    let tree =
        usvg::Tree::from_data(svg_data, &opt).map_err(|e| format!("SVG parse error: {e}"))?;

    let size = tree.size().to_int_size();
    let mut pixmap = tiny_skia::Pixmap::new(size.width(), size.height())
        .ok_or_else(|| "Failed to create pixmap (invalid dimensions)".to_string())?;

    resvg::render(&tree, tiny_skia::Transform::default(), &mut pixmap.as_mut());

    pixmap
        .encode_png()
        .map_err(|e| format!("PNG encode error: {e}"))
}

/// Write data to a file atomically: write to a temp file in the same directory,
/// then rename. This prevents partial writes on crash or disk-full.
fn write_atomically(path: &str, data: &[u8]) -> std::io::Result<()> {
    let parent = std::path::Path::new(path)
        .parent()
        .unwrap_or(std::path::Path::new("."));
    let mut tmp = tempfile::NamedTempFile::new_in(parent)?;
    tmp.write_all(data)?;
    tmp.persist(path)?;
    Ok(())
}

#[magnus::init]
fn init(ruby: &Ruby) -> Result<(), Error> {
    let module = ruby.define_module("Smalruby3")?;
    let image_util = module.define_module("ImageUtil")?;
    image_util.define_singleton_method("convert_svg_to_png", function!(convert_file, 2))?;
    image_util.define_singleton_method("svg_to_png_bytes", function!(convert_bytes, 1))?;
    image_util.define_singleton_method("save_png", function!(save_png, 4))?;
    Ok(())
}
