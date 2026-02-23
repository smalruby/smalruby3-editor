# TypeProf LSP Server bootstrap for Smalruby
# Based on https://github.com/mame/typeprof.wasm/blob/main/src/bootstrap.rb

# Skip require "io/console" and "socket"
# (they are not used in TypeProf on ruby.wasm)
$LOADED_FEATURES << "io/console.so" << "socket.so"

# File.readable? does not work with bjorn3/browser_wasi_shim
def File.readable?(...) = File.file?(...)

# Set up a workspace
Dir.mkdir("/workspace")
File.write("/workspace/typeprof.conf.json", <<~JSON)
  {
    "typeprof_version": "experimental",
    "rbs_dir": ".",
    "analysis_unit_dirs": ["."]
  }
JSON
File.write("/workspace/main.rb", "")
File.write("/workspace/smalruby.rbs", "")

require "typeprof"

class Server
  def initialize
    @read_msg = nil
    @error = nil
  end

  def setup
    @core = TypeProf::Core::Service.new({})
    nil
  end

  def start(post_message)
    @post_message = post_message
    @fiber = Fiber.new do
      TypeProf::LSP::Server.new(
        @core, self, self,
        url_schema: "inmemory:",
        publish_all_diagnostics: true
      ).run
    end
    @fiber.resume
  end

  def add_msg(msg)
    @read_msg = JSON.parse(msg.to_s, symbolize_names: true)
    @fiber.resume
    if @error
      error, @error = @error, nil
      raise error
    end
  end

  def read
    while true
      Fiber.yield until @read_msg
      begin
        yield @read_msg
      rescue => e
        @error = e
      ensure
        @read_msg = nil
      end
    end
  end

  def write(**json)
    json = JSON.generate(json.merge(jsonrpc: "2.0"))
    @post_message.apply(json)
  end
end

Server.new
