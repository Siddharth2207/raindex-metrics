{
  description = "Flake for development workflows.";

  inputs = {
    flake-utils.url = "github:numtide/flake-utils";
    rainix.url = "github:rainprotocol/rainix";
  };

  outputs = {self, rainix, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = rainix.pkgs.${system};
      in rec {
        packages = rec {

          build-js-bindings = rainix.mkTask.${system} {
            name = "build-js-bindings";
            body = ''
              set -euxo pipefail
              npm install
              npm run build
            '';
          };

          raindex-metrics = rainix.mkTask.${system} {
            name = "raindex-metrics";
            body = ''
              set -euxo pipefail
              if [ -z "''${TOKEN_SYMBOL}" ] || [ -z "''${NETWORK}" ]; then
                echo "Error: TOKEN_SYMBOL and NETWORK environment variables must be set."
                exit 1
              fi
              echo "Running raindex-metrics with TOKEN_SYMBOL="''${TOKEN_SYMBOL}" and NETWORK="''${NETWORK}""
              node dist/index.js --token "''${TOKEN_SYMBOL}" --network "''${NETWORK}"
            '';
          };

        };

        devShells.default = pkgs.mkShell {
          packages = [
            packages.build-js-bindings
            packages.raindex-metrics
          ];

          shellHook = rainix.devShells.${system}.default.shellHook;
          buildInputs = rainix.devShells.${system}.default.buildInputs;
          nativeBuildInputs = rainix.devShells.${system}.default.nativeBuildInputs;
        };

      }
    );
}
