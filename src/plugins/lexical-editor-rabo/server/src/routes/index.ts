export default [
  {
    method: 'GET',
    path: '/search/:model/:field',
    handler: 'lexicalSearch.search',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'GET',
    path: '/get/:collectionName/:documentId',
    handler: 'lexicalSearch.get',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'GET',
    path: '/identify/:collectionName',
    handler: 'lexicalSearch.identify',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  // Populate API routes
  {
    method: 'GET',
    path: '/populate/:contentType/:documentId',
    handler: 'lexicalPopulate.populateEntity',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'POST',
    path: '/populate-bulk/:contentType',
    handler: 'lexicalPopulate.populateBulk',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'GET',
    path: '/references/:contentType/:documentId',
    handler: 'lexicalPopulate.getReferences',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
  {
    method: 'POST',
    path: '/validate-references',
    handler: 'lexicalPopulate.validateReferences',
    config: {
      policies: ['admin::isAuthenticatedAdmin'],
    },
  },
];
