import type { Core } from '@strapi/strapi';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // register phase
  strapi.customFields.register({
    name: 'lexical',
    plugin: 'lexical',
    type: 'json',
    inputSize: { default: 12, isResizable: true },
  });
};

export default register;
