# frozen_string_literal: true

module Smalruby3
  # Versioning scheme: YY.MR.DDR
  #   YY  = year (last 2 digits, e.g. 26 = 2026)
  #   MR  = month * 10 + monthly release number (e.g. 31 = March, 1st release)
  #   DDR = day * 10 + daily release number (e.g. 291 = 29th, 1st release)
  VERSION = "26.31.291"
end
