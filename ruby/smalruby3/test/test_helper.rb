# frozen_string_literal: true

$LOAD_PATH.unshift File.expand_path("../lib", __dir__)

# Prevent at_exit hook from starting the runtime during tests
ENV["SMALRUBY3_TESTING"] = "1"

require "smalruby3"
require "minitest/autorun"
require "minitest/mock"
