# frozen_string_literal: true

require "net/http"
require "uri"
require "tempfile"

module Smalruby3
  class AssetManager
    # Secure HTTP asset downloader with HTTPS enforcement,
    # redirect validation, size limits, and atomic writes.
    module Downloader
      SCRATCH_ASSET_URL = "https://assets.scratch.mit.edu/internalapi/asset/%{md5ext}/get/"
      SMALRUBY_ASSET_BASE_URL = "https://smalruby.app/"
      MAX_ASSET_SIZE = 10 * 1024 * 1024

      module_function

      # Build download URL, rejecting absolute rawURL values.
      def build_download_url(md5ext, raw_url)
        if raw_url
          if raw_url.match?(%r{\A[a-z]+://}i)
            warn "[Smalruby3] Rejecting absolute rawURL: #{raw_url}"
            return nil
          end
          URI.join(SMALRUBY_ASSET_BASE_URL, raw_url).to_s
        else
          format(SCRATCH_ASSET_URL, md5ext: md5ext)
        end
      end

      # Download file with security checks and atomic write.
      def safe_download(url, dest_path)
        uri = URI.parse(url)
        validate_uri!(uri)

        body = fetch_with_redirects(uri)
        return nil unless body

        write_atomically(dest_path, body)
      end

      def fetch_with_redirects(uri, redirects_remaining = 3)
        response = https_get(uri)

        redirects_remaining.times do
          break unless response.is_a?(Net::HTTPRedirection)

          location = response["location"]
          uri = URI.parse(location)
          validate_uri!(uri)
          response = https_get(uri)
        end

        if response.is_a?(Net::HTTPSuccess)
          body = response.body
          if body.bytesize > MAX_ASSET_SIZE
            warn "[Smalruby3] Asset too large (#{body.bytesize} bytes, max #{MAX_ASSET_SIZE})"
            return nil
          end
          body
        else
          warn "[Smalruby3] HTTP #{response.code} for #{uri}"
          nil
        end
      end

      def https_get(uri)
        http = Net::HTTP.new(uri.host, uri.port)
        http.use_ssl = true
        http.open_timeout = 10
        http.read_timeout = 30
        http.request(Net::HTTP::Get.new(uri))
      end

      def validate_uri!(uri)
        unless uri.is_a?(URI::HTTPS)
          raise SecurityError, "Only HTTPS URLs are allowed (got #{uri.scheme})"
        end
      end

      # Write content atomically to prevent symlink TOCTOU attacks.
      def write_atomically(dest_path, content)
        if File.symlink?(dest_path)
          warn "[Smalruby3] Refusing to write to symlink: #{dest_path}"
          return nil
        end

        dir = File.dirname(dest_path)
        tmp = Tempfile.new("smalruby3-", dir)
        tmp.binmode
        tmp.write(content)
        tmp.close
        File.rename(tmp.path, dest_path)
        dest_path
      rescue => e
        tmp&.close!
        raise e
      end
    end
  end
end
