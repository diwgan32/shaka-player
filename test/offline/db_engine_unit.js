/**
 * @license
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

describe('DBEngine', function() {
  const UNSUPPORTED_UPGRADE_REQUEST =
      shaka.util.Error.Code.UNSUPPORTED_UPGRADE_REQUEST;

  const OfflineUtils = shaka.test.OfflineUtils;

  /** @const {string} */
  const dbName = 'shaka-player-test-db';

  function deleteOld() {
    return shaka.offline.DBEngine.deleteDatabase(dbName);
  }

  function openDB() {
    const dbUpdateRetries = 5;
    let db = new shaka.offline.DBEngine(dbName);
    return db.init(dbUpdateRetries)
        .then(() => db)
        .catch((e) => {
          // Make sure that if there is an error, that the db engine is
          // destroyed or else we may not be able to delete it later.
          return db.destroy().then(() => { throw e; });
        });
  }

  describe('upgrade failures', function() {
    it('fails to open with old version', checkAndRun((done) => {
      // Create a mock old database with the manifest tables.
      deleteOld()
          .then(() => {
            return shaka.test.SimpleIDB.open(dbName, 1, []);
          })
          .then((sdb) => sdb.close())
          .then(openDB)
          // We expect a failure because the other database should keep the db
          // engine from starting easily.
          .then(fail)
          .catch((e) => {
            expect(e.code).toBe(UNSUPPORTED_UPGRADE_REQUEST);
            done();
          });
    }));

    it('opens if we delete the old database', checkAndRun((done) => {
      // Create a mock old database with the manifest table.
      deleteOld()
          .then(() => {
            return shaka.test.SimpleIDB.open(dbName, 1, ['manifest']);
          })
          .then((sdb) => sdb.close())
          .then(openDB)
          // We expect a failure because the other database should keep the db
          // engine from starting easily.
          .then(fail)
          .catch((e) => {
            expect(e.code).toBe(UNSUPPORTED_UPGRADE_REQUEST);
          })
          .then(deleteOld)
          .then(openDB)
          // We should have been able to open the database as we deleted the
          // old version.
          .then((db) => db.destroy())
          .catch(fail)
          .then(done);
    }));

    it('can add to database after delete', checkAndRun((done) => {
      const manifest = OfflineUtils.createManifest('original manifest');

      // Create a mock old database with the manifest table.
      deleteOld()
          .then(() => {
            return shaka.test.SimpleIDB.open(dbName, 1, ['manifest']);
          })
          .then((sdb) => sdb.close())
          .then(openDB)
          // We expect a failure because the other database should keep the db
          // engine from starting easily.
          .then(fail)
          .catch((e) => {
            expect(e.code).toBe(UNSUPPORTED_UPGRADE_REQUEST);
          })
          .then(deleteOld)
          .then(openDB)
          // We should have been able to open the database as we deleted the
          // old version.
          .then((db) => {
            return db.addManifest(manifest).then(() => db.destroy());
          })
          .catch(fail)
          .then(done);
    }));
  });

  it('stores and retrieves a manifest', checkAndRun(function(done) {
    /** @type {shakaExtern.ManifestDB} */
    var original = OfflineUtils.createManifest('original manifest');

    deleteOld().then(openDB).then((db) => {
      return db.addManifest(original)
          .then((id) => db.getManifest(id))
          .then((copy) => {
            expect(copy).toEqual(original);
            return db.destroy();
          });
    }).catch(fail).then(done);
  }));

  it('stores and retrieves many manifest', checkAndRun(function(done) {
    /** @type {!Array<shakaExtern.ManifestDB>} */
    var originals = [
      OfflineUtils.createManifest('original manifest 1'),
      OfflineUtils.createManifest('original manifest 2'),
      OfflineUtils.createManifest('original manifest 3'),
      OfflineUtils.createManifest('original manifest 4')
    ];

    /** @type {!Array<shakaExtern.ManifestDB>} */
    var copies = [];

    deleteOld().then(openDB).then((db) => {
      return Promise.all(originals.map((original) => db.addManifest(original)))
          .then(() => {
            return db.forEachManifest((id, manifest) => copies.push(manifest));
          })
          .then(() => {
            originals.forEach((original) => expect(copies).toContain(original));
            return db.destroy();
          });
    }).catch(fail).then(done);
  }));

  it('stores and removes a manifest', checkAndRun(function(done) {
    /** @type {shakaExtern.ManifestDB} */
    var original = OfflineUtils.createManifest('original manifest');

    /** @type {number} */
    var id;

    deleteOld().then(openDB).then((db) => {
      return db.addManifest(original)
          .then((newId) => {
            id = newId;
            return db.getManifest(id);
          })
          .then((value) => {
            expect(value).toEqual(original);
            return db.removeManifests([id], null);
          })
          .then(() => {
            return db.getManifest(id);
          })
          .then((copy) => {
            expect(copy).toBeFalsy();
            return db.destroy();
          });
    }).catch(fail).then(done);
  }));

  it('stores and retrieves a segment', checkAndRun(function(done) {
    /** @type {shakaExtern.SegmentDataDB} */
    var original = OfflineUtils.createSegmentData([0, 1, 2]);

    deleteOld().then(openDB).then((db) => {
      return db.addSegment(original)
          .then((id) => db.getSegment(id))
          .then((copy) => OfflineUtils.expectSegmentToEqual(copy, original))
          .then(() => db.destroy());
    }).catch(fail).then(done);
  }));

  it('stores and retrieves many segments', checkAndRun(function(done) {
    /** @type {!Array<shakaExtern.SegmentDataDB>} */
    var originals = [
      OfflineUtils.createSegmentData([0]),
      OfflineUtils.createSegmentData([1, 2]),
      OfflineUtils.createSegmentData([3, 4, 5]),
      OfflineUtils.createSegmentData([6, 7, 8, 9])
    ];

    /** @type {!Array<shakaExtern.SegmentDataDB>} */
    var copies = [];

    deleteOld().then(openDB).then((db) => {
      return Promise.all(originals.map((original) => db.addSegment(original)))
          .then(() => db.forEachSegment((id, segment) => copies.push(segment)))
          .then(() => originals.forEach((original) => {
            OfflineUtils.expectSegmentsToContain(copies, original);
            return db.destroy();
          }));
    }).catch(fail).then(done);
  }));

  it('stores and removes a segment', checkAndRun(function(done) {
    /** @type {shakaExtern.SegmentDataDB} */
    var original = OfflineUtils.createSegmentData([0, 1, 2]);

    /** @type {number} */
    var id;

    deleteOld().then(openDB).then((db) => {
      return db.addSegment(original)
          .then((newId) => {
            id = newId;
            return db.getSegment(id);
          })
          .then((value) => {
            OfflineUtils.expectSegmentToEqual(value, original);
            return db.removeSegments([id], null);
          })
          .then(() => {
            return db.getSegment(id);
          })
          .then((copy) => {
            expect(copy).toBeFalsy();
            return db.destroy();
          });
    }).catch(fail).then(done);
  }));

  /**
   * Before running the test, check if DBEngine is supported on this platform.
   * @param {function(function())} test
   * @return {function(function())}
   */
  function checkAndRun(test) {
    return function(done) {
      if (shaka.offline.DBEngine.isSupported()) {
        test(done);
      } else {
        pending('DBEngine is not supported on this platform.');
      }
    };
  }
});
