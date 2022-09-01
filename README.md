# Chunking stability benchmark

Webpack (browser) based benchmark for two content defined chunking algorithms: `fastcdc` and `buzhash`. For efficiency the chunking module is written in [rust](https://github.com/dstanesc/wasm-chunking-eval) and compiled in web assembly

The project uses [synthetic material data](https://www.npmjs.com/package/@dstanesc/fake-material-data) for data generation and [store-chunky-bytes](https://www.npmjs.com/package/@dstanesc/store-chunky-bytes) for persisting chunked byte arrays. The chunking library is [wasm-chunking-webpack-eval](https://www.npmjs.com/package/@dstanesc/wasm-chunking-webpack-eval) 

The binary data is derived from raw material libraries in four ways: [json text encoding](https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder), [msgpack encoded](https://www.npmjs.com/package/msgpackr), combined msgpack encoded plus [lz4 compressed](https://www.npmjs.com/package/lz4) and combined msgpack encoded plus zlib (aka [pako](https://www.npmjs.com/package/pako)) compressed


## Execute Benchmark

```
npm run clean // optional
npm install
npm run build
npm start
```

A browser page will open and guide the execution.

##  Example Results



