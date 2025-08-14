export default ({ env }) => ({
  upload: {
    config: {
      provider: "strapi-provider-cloudflare-r2",
      providerOptions: {
        accessKeyId: env("CF_ACCESS_KEY_ID"),
        secretAccessKey: env("CF_ACCESS_SECRET"),
        endpoint: env("CF_ENDPOINT"),
        params: {
          Bucket: env("CF_BUCKET")
        },
        cloudflarePublicAccessUrl: env("CF_PUBLIC_ACCESS_URL")
      }
    }
  },
  "list-field": {
    enabled: true,
    resolve: "./src/plugins/list-field"
  },
  lexical: {
    enabled: true,
    resolve: "./src/plugins/lexical-editor-rabo"
  }
});
