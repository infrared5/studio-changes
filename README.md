# JavaScript Studio Changes

Generate changes as part of `npm version [patch|minor|major]`.

## Install

```bash
$ npm install @studio/changes -D
```

## Configure

Add this to your `package.json`:

```json
{
  "scripts": {
    "version": "changes"
  }
}
```

## Usage

- Use the [npm version feature][1] as usual
- You editor will open with a generated `CHANGES.md` file
- Save and close the editor to continue
- Remove the line with the next version number to abort

[1]: https://docs.npmjs.com/cli/version
