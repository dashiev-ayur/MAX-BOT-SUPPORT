module.exports = {
  apps: [
    {
      name: "max-bot",
      cwd: "/opt/MAX-SUPPORT-BOT",
      script: "dist/main.js",
      interpreter: "node",
      node_args: "--env-file=.env",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        NODE_EXTRA_CA_CERTS: "/usr/local/share/ca-certificates/russian-ca-bundle.pem",
      },
    },
  ],
};
