import test from 'node:test';
import assert from 'node:assert/strict';
import { getStates, getCities, getCountries } from '../lib/locations/server.ts';

test('Location Service: getStates returns paginated Indian states with city counts', () => {
  const result = getStates({ country: 'India', page: 1, limit: 10 });

  assert.equal(result.page, 1);
  assert.equal(result.data.length, 10);
  assert.ok(result.total >= 30, 'India should have 30+ states/UTs');
  assert.equal(result.hasMore, true);

  const karnataka = result.data.find((s) => s.name === 'Karnataka');
  if (karnataka) {
    assert.ok(karnataka.cities_count > 100);
  }
});

test('Location Service: getStates search filters accurately with prefix priority', () => {
  const searchResult = getStates({ country: 'India', search: 'karn' });

  assert.ok(searchResult.data.length >= 1);
  assert.equal(searchResult.data[0].name, 'Karnataka');
  assert.equal(searchResult.hasMore, false);
});

test('Location Service: getCities returns cities scoped to state with lazy loading pagination', () => {
  const page1 = getCities({ country: 'India', state: 'Karnataka', page: 1, limit: 20 });

  assert.equal(page1.page, 1);
  assert.equal(page1.data.length, 20);
  assert.ok(page1.total > 200, 'Karnataka should have 200+ cities');
  assert.equal(page1.hasMore, true);

  const page2 = getCities({ country: 'India', state: 'Karnataka', page: 2, limit: 20 });

  assert.equal(page2.page, 2);
  assert.equal(page2.data.length, 20);
  assert.notDeepEqual(page1.data[0], page2.data[0]);
});

test('Location Service: getCities search instantly finds Bengaluru within Karnataka', () => {
  const searchResult = getCities({ country: 'India', state: 'Karnataka', search: 'bengaluru' });

  assert.ok(searchResult.data.length >= 1);
  const bengaluru = searchResult.data.find((c) => c.name === 'Bengaluru');
  assert.ok(bengaluru, 'Bengaluru should be in search results');
  assert.equal(bengaluru.state, 'Karnataka');
});

test('Location Service: getCountries returns country list with India priority', () => {
  const result = getCountries({ limit: 5 });

  assert.equal(result.data.length, 5);
  assert.equal(result.data[0].name, 'India');
});
