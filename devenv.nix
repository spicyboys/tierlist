{ pkgs, lib, config, inputs, ... }:

{
  packages = [
    pkgs.cloudflared
  ];

  languages = {
    javascript = {
      enable = true;
      npm.enable = true;
    };
  };
}
