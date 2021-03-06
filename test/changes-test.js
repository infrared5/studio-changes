/*eslint-env mocha*/
'use strict';

const fs = require('fs');
const $ = require('child_process');
const assert = require('assert');
const sinon = require('sinon');
const changes = require('..');

describe('changes', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    sandbox.stub(fs, 'readFileSync');
    sandbox.stub(fs, 'writeFileSync');
    sandbox.stub($, 'execSync');
    sandbox.stub(process, 'exit');
    sandbox.stub(console, 'error');
    fs.readFileSync.withArgs('package.json').returns(JSON.stringify({
      version: '1.0.0',
      author: 'Studio <support@javascript.studio>'
    }));
  });

  afterEach(() => {
    sandbox.restore();
  });

  function missingChanges() {
    fs.readFileSync.withArgs('CHANGES.md').throws(new Error());
  }

  function setChanges(str) {
    fs.readFileSync.withArgs('CHANGES.md').returns(str);
  }

  function setLog(log) {
    $.execSync.returns(log);
  }

  it('defaults changes file to CHANGES.md', () => {
    assert.equal(changes.getFile(), 'CHANGES.md');
  });

  it('can set changes file to custom name', () => {
    changes.setFile('foo.txt');

    assert.equal(changes.getFile(), 'foo.txt');

    missingChanges();
    setLog('foo');

    changes.write();

    sinon.assert.calledWith(fs.writeFileSync, 'foo.txt');

    changes.setFile('CHANGES.md'); // reset state
  });

  it('generates new changes file', () => {
    missingChanges();
    setLog('» Inception (That Dude)\n\n\n');

    changes.write();

    sinon.assert.calledOnce(fs.writeFileSync);
    sinon.assert.calledWith(fs.writeFileSync, 'CHANGES.md',
      '# Changes\n\n## 1.0.0\n\n- Inception (That Dude)\n');
    sinon.assert.calledOnce($.execSync);
    sinon.assert.calledWithMatch($.execSync, 'git log  --format=');
  });

  it('removes package author', () => {
    missingChanges();
    setLog('» Inception (Studio)\n\n\n');

    changes.write();

    sinon.assert.calledOnce(fs.writeFileSync);
    sinon.assert.calledWith(fs.writeFileSync, 'CHANGES.md',
      '# Changes\n\n## 1.0.0\n\n- Inception\n');
  });

  it('add commit log to existing changes file', () => {
    const initial = '# Changes\n\n## 0.1.0\n\nSome foo.\n';
    setChanges(initial);
    setLog('» Inception (Studio)\n\n\n');

    const previous = changes.write();

    sinon.assert.calledOnce(fs.writeFileSync);
    sinon.assert.calledWith(fs.writeFileSync, 'CHANGES.md',
      '# Changes\n\n## 1.0.0\n\n- Inception\n\n## 0.1.0\n\nSome foo.\n');
    sinon.assert.calledOnce($.execSync);
    sinon.assert.calledWithMatch($.execSync, 'git log v0.1.0..HEAD');
    assert.equal(previous, initial);
  });

  it('identifies previous commit with -beta suffix', () => {
    setChanges('# Changes\n\n## 0.1.0-beta\n\nSome foo.\n');
    setLog('» Inception (Studio)\n\n\n');

    changes.write();

    sinon.assert.calledWithMatch($.execSync, 'git log v0.1.0-beta..HEAD');
  });

  it('adds body indented on new line', () => {
    missingChanges();
    setLog('» Inception (Studio)\n\nFoo Bar Doo\n\n» Other (Dude)\n\n\n'
      + '» Third (Person)\n\nDoes\nstuff\n\n');

    changes.write();

    sinon.assert.calledOnce(fs.writeFileSync);
    sinon.assert.calledWith(fs.writeFileSync, 'CHANGES.md',
      '# Changes\n\n## 1.0.0\n\n'
      + '- Inception\n\n    > Foo Bar Doo\n\n'
      + '- Other (Dude)\n'
      + '- Third (Person)\n\n    > Does\n    > stuff\n\n');
  });

  it('properly indents lists', () => {
    missingChanges();
    setLog('» Inception (Studio)\n\n- Foo\n- Bar\n- Doo\n\n');

    changes.write();

    sinon.assert.calledOnce(fs.writeFileSync);
    sinon.assert.calledWith(fs.writeFileSync, 'CHANGES.md',
      '# Changes\n\n## 1.0.0\n\n'
      + '- Inception\n\n    > - Foo\n    > - Bar\n    > - Doo\n\n');
  });

  it('fails if changes file has not the right format', () => {
    setChanges('# Something else\n\n## 1.0.0\n\nFoo');

    changes.write();

    sinon.assert.calledOnce(console.error);
    sinon.assert.calledWith(console.error, 'Unexpected CHANGES.md file header');
    sinon.assert.calledOnce(process.exit);
    sinon.assert.calledWith(process.exit, 1);
  });

  it('fails if version is already in changes file', () => {
    setChanges('# Changes\n\n## 1.0.0\n\nFoo');
    setLog('foo');

    changes.write();

    sinon.assert.calledWith(console.error,
      'Version 1.0.0 is already in CHANGES.md\n');
    sinon.assert.calledOnce(process.exit);
    sinon.assert.calledWith(process.exit, 1);
  });

  it('shows outstanding changes if version is already in changes file', () => {
    setChanges('# Changes\n\n## 1.0.0\n\nFoo');
    setLog('» Up next (Studio)\n\n\n');

    changes.write();

    sinon.assert.calledWith(console.error, '# Changes for next release:\n');
    sinon.assert.calledWith(console.error, '- Up next\n');
  });

  it('does not show outstanding changes if no new commits where found', () => {
    setChanges('# Changes\n\n## 1.0.0\n\nFoo');
    setLog('');

    changes.write();

    sinon.assert.calledWith(console.error,
      'Version 1.0.0 is already in CHANGES.md\n');
    sinon.assert.neverCalledWith(console.error,
      '# Changes for next release:\n');
  });

  it('works if changes file was checked out with CRLF', () => {
    const initial = '# Changes\r\n\r\n## 0.0.1\r\n\r\n- Inception\r\n';
    setChanges(initial);
    setLog('» JavaScript (Studio)\n\nWhat else?\n\n\n');

    const previous = changes.write();

    sinon.assert.calledOnce(fs.writeFileSync);
    sinon.assert.calledWith(fs.writeFileSync, 'CHANGES.md', '# Changes\r\n\r\n'
      + '## 1.0.0\r\n\r\n- JavaScript\r\n\r\n    > What else?\r\n\r\n'
      + '## 0.0.1\r\n\r\n- Inception\r\n');
    sinon.assert.calledOnce($.execSync);
    sinon.assert.calledWithMatch($.execSync, 'git log v0.0.1..HEAD');
    assert.equal(previous, initial);
  });

  it('fails if version is already in changes file with CRLF', () => {
    setChanges('# Changes\r\n\r\n## 1.0.0\r\n\r\nFoo');
    setLog('foo');

    changes.write();

    sinon.assert.calledWith(console.error,
      'Version 1.0.0 is already in CHANGES.md\n');
    sinon.assert.calledOnce(process.exit);
    sinon.assert.calledWith(process.exit, 1);
  });

});
