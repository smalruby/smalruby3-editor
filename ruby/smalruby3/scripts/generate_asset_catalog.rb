#!/usr/bin/env ruby
# frozen_string_literal: true

# Generate asset_catalog.json from scratch-gui library JSON files.
# Usage: ruby scripts/generate_asset_catalog.rb

require "json"

REPO_ROOT = File.expand_path("../../..", __dir__)
LIBRARIES_DIR = File.join(REPO_ROOT, "packages", "scratch-gui", "src", "lib", "libraries")
OUTPUT_PATH = File.join(File.expand_path("..", __dir__), "lib", "smalruby3", "asset_catalog.json")

sprites = JSON.parse(File.read(File.join(LIBRARIES_DIR, "sprites.json")))
backdrops = JSON.parse(File.read(File.join(LIBRARIES_DIR, "backdrops.json")))

catalog = {
  "sprites" => {},
  "backdrops" => {}
}

sprites.each do |sprite|
  name = sprite["name"]
  catalog["sprites"][name] = {
    "costumes" => sprite["costumes"].map { |c|
      entry = {
        "name" => c["name"],
        "md5ext" => c["md5ext"],
        "dataFormat" => c["dataFormat"],
        "rotationCenterX" => c["rotationCenterX"],
        "rotationCenterY" => c["rotationCenterY"],
        "bitmapResolution" => c["bitmapResolution"] || 1
      }
      entry["rawURL"] = c["rawURL"] if c["rawURL"]
      entry
    },
    "sounds" => sprite["sounds"].map { |s|
      {
        "name" => s["name"],
        "md5ext" => s["md5ext"],
        "dataFormat" => s["dataFormat"]
      }
    }
  }
end

backdrops.each do |b|
  entry = {
    "md5ext" => b["md5ext"],
    "dataFormat" => b["dataFormat"],
    "rotationCenterX" => b["rotationCenterX"],
    "rotationCenterY" => b["rotationCenterY"],
    "bitmapResolution" => b["bitmapResolution"] || 1
  }
  entry["rawURL"] = b["rawURL"] if b["rawURL"]
  catalog["backdrops"][b["name"]] = entry
end

File.write(OUTPUT_PATH, JSON.pretty_generate(catalog) + "\n")
puts "Generated #{OUTPUT_PATH}"
puts "  Sprites: #{catalog["sprites"].size}"
puts "  Backdrops: #{catalog["backdrops"].size}"
