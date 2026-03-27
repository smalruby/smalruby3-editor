#!/usr/bin/env ruby
# frozen_string_literal: true

# Build the smalruby3 launcher binary (SDL2 main thread wrapper).
# Based on rsdl's extconf.rb.

require "mkmf"
require "erb"

# Source directory where .in templates live
srcdir = File.dirname(File.expand_path(__FILE__))

dir_config("sdl")
sdlconfig = with_config("sdl-config", "sdl-config")

config = {}
config["arch"] = RbConfig::CONFIG["arch"]
config["INSTALL"] = RbConfig::CONFIG["INSTALL"]
config["RMALL"] = RbConfig::CONFIG["RMALL"] || "rm -fr"
config["CC"] = RbConfig::CONFIG["CC"]
config["CFLAGS"] = RbConfig::CONFIG["CFLAGS"]
config["CFLAGS"] += " -I\"#{$hdrdir}\"" if $hdrdir
config["CFLAGS"] += " -I\"#{$arch_hdrdir}\"" if $arch_hdrdir
config["CFLAGS"] += " " + `"#{sdlconfig}" --cflags` if sdlconfig && !sdlconfig.empty?
config["LDFLAGS"] = RbConfig::CONFIG["LDFLAGS"]
config["LIBS"] = RbConfig::CONFIG["LIBS"]
config["LIBS"] += " " + `"#{sdlconfig}" --libs` if sdlconfig && !sdlconfig.empty?
config["LIBPATH"] = RbConfig.expand(libpathflag)
config["LIBRUBYARG"] = RbConfig::CONFIG["LIBRUBYARG"]
config["EXEEXT"] = RbConfig::CONFIG["EXEEXT"]
config["bindir"] = RbConfig::CONFIG["bindir"]
# gem_dir: where the gem is installed (for install target)
config["gem_dir"] = srcdir

headers = []
headers << "#define HAVE_RUBY_SYSINIT 1" if have_func("ruby_sysinit")
headers << "#define HAVE_RUBY_RUN_NODE 1" if have_func("ruby_run_node")
config["COMMON_HEADERS"] = ([(COMMON_HEADERS || "")] + headers).join("\n")

%w[Makefile smalruby3_launcher.c].each do |file|
  # Read template from source directory
  template_path = File.join(srcdir, file + ".in")
  template = ERB.new(File.read(template_path), trim_mode: "%")
  message "creating %s\n" % file
  File.open(file, "w") do |f|
    f.print template.result(binding)
  end
end
