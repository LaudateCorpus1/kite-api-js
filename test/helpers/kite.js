'use strict';

const path = require('path');
const {withKiteRoutes} = require('kite-connect/test/helpers/support');
const {fakeResponse} = require('kite-connect/test/helpers/http');

function withKiteLogin(status) {
  let login;
  afterEach(() => {
    login = undefined;
  });

  withKiteRoutes([[
    o => o.path === '/api/account/login',
    o => {
      login = true;
      return fakeResponse(status);
    },
  ], [
    o => o.path === '/api/account/authenticate',
    o => {
      login = true;
      return fakeResponse(status);
    },
  ], [
    o => o.path === '/clientapi/user',
    o => login
      ? fakeResponse(200, '{"id": "some-id"}')
      : fakeResponse(401),
  ]]);
}

function withKitePaths(paths = {}, defaultStatus) {
  const authRe = /^\/clientapi\/permissions\/authorized\?filename=(.+)$/;
  const projectDirRe = /^\/clientapi\/projectdir\?filename=(.+)$/;
  const notifyRe = /^\/clientapi\/permissions\/notify\?filename=(.+)$/;
  const blacklistRe = /^\/clientapi\/permissions\/blacklist/;
  const whitelistRe = /^\/clientapi\/permissions\/whitelist/;

  const whitelisted = match =>
    (paths.whitelist || []).some(p => match.startsWith(p));
  const blacklisted = match =>
    (paths.blacklist || []).some(p => match.startsWith(p));
  const ignored = match =>
    (paths.ignore || []).some(p => match.startsWith(p));

  const routes = [
    [
      o => notifyRe.exec(o.path),
      o => {
        const match = notifyRe.exec(o.path);
        return match &&
               !whitelisted(match[1]) &&
               !ignored(match[1]) &&
               !blacklisted(match[1])
          ? fakeResponse(200)
          : fakeResponse(403);
      },
    ], [
      o => {
        const match = authRe.exec(o.path);
        return match && whitelisted(match[1]);
      },
      o => fakeResponse(defaultStatus || 200),
    ], [
      o => {
        const match = authRe.exec(o.path);
        return match && (!whitelisted(match[1]) || ignored(match[1]));
      },
      o => fakeResponse(defaultStatus || 403),
    ], [
      o => {
        const match = projectDirRe.exec(o.path);
        return o.method === 'GET' && match && blacklisted(match[1]);
      },
      o => fakeResponse(defaultStatus || 403),
    ], [
      o => projectDirRe.test(o.path),
      o => {
        const match = projectDirRe.exec(o.path);
        return fakeResponse(defaultStatus || 200, path.dirname(match[1]));
      },
    ], [
      (o, data) => {
        const [path] = data ? JSON.parse(data) : [];
        return whitelistRe.test(o.path) &&
               !(whitelisted(path) || blacklisted(path)) &&
               o.method === 'PUT';
      },
      o => fakeResponse(defaultStatus || 200),
    ], [
      (o, data) => {
        data = data ? JSON.parse(data) : {};
        const path = data.paths ? data.paths[0] : null;
        return blacklistRe.test(o.path) &&
               !(whitelisted(path) || blacklisted(path)) &&
               o.method === 'PUT';
      },
      o => fakeResponse(defaultStatus || 200),
    ],
  ];

  withKiteRoutes(routes);
}

module.exports = {
  withKiteLogin,
  withKitePaths,
};