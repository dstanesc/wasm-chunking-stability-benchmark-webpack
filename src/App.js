import React, { useEffect, useState, useRef } from 'react';
import './App.css';

import { simpleMaterialJson } from '@dstanesc/fake-material-data'
import { partReport } from '@dstanesc/fake-metrology-data'
import { chunkyStore } from '@dstanesc/store-chunky-bytes'
import { codec, blockStore, chunkerFactory } from './util.js'

import { pack } from 'msgpackr';
import * as lz4 from 'lz4js'
import * as pako from 'pako'
import * as b64 from 'base64-js'

import { layout, trace } from './plot';

function App() {

  const [b30, setB30] = useState("[30s]")
  const [b300, setB300] = useState("[300s]")
  const [b1200, setB1200] = useState("[1200s]")

  const totalBlocksBefore = useRef(new Map())
  const totalBlocksAfter = useRef(new Map())
  const blocksReused = useRef(new Map())
  const blocksDiff = useRef(new Map())
  const reuseRatios = useRef(new Map())
  const bytesTotal = useRef(new Map())

  const TEXT_ENCODER = new TextEncoder()

  function formatLabel(input) {
    const tokens = input.split("-")
    return tokens.map(val => val.charAt(0).toUpperCase() + val.slice(1)).reduce((txt, val) => `${txt} ${val}`, "")
  }

  const renderCategory = (matCount, matCountChange, changeOffset, chunkerConfig, changePolicy, divName) => {
    const traces = []
    reuseRatios.current.forEach((value, key) => {
      if (key.startsWith(matCount.toString())) {
        const what = key.split("-")
        const alg = what[2]; //eg. fastcdc, buzhash
        const lib = what[1]; // eg. json, packr, pako, lz4
        //const count = what[0]; // 300, 600, 1200, etc
        const totalCountBefore = totalBlocksBefore.current.get(key)
        const totalCountAfter = totalBlocksAfter.current.get(key)
        const reuseRatio = reuseRatios.current.get(key)
        const reuseCount = blocksReused.current.get(key)
        const newCount = blocksDiff.current.get(key)
        const bytes = bytesTotal.current.get(key)
        const hoverText = `${alg}, ${lib}`
        const t = trace({ lib, alg, count: totalCountAfter, bytes, values: [totalCountBefore, totalCountAfter, newCount, reuseCount, reuseRatio], text: [hoverText, hoverText, hoverText, hoverText, hoverText] });

        traces.push(t);
      }
    });
    const l1 = layout(`<b>${formatLabel(divName)}:</b> ${matCount} materials, ${matCountChange} ${changePolicy} materials at offset: ${changeOffset}, fastcdc block size: ${chunkerConfig.fastAvgSize / 2} to ${chunkerConfig.fastAvgSize * 2} bytes, buzhash mask: ${chunkerConfig.buzMask}`);
    Plotly.newPlot(divName, traces, l1);
  }

  const roll = async (totalSize, chunkerConfig) => {

    cleanUp()

    const changeSize = 3
    const changeOffset = Math.floor((totalSize - 1) / 2)
    await rollInternal(chunkerConfig, totalSize, totalSize, changeSize, 'appended', appendDataSets, 'append')
    await rollInternal(chunkerConfig, totalSize, changeOffset, changeSize, 'inserted', insertDataSets, 'insert')
    await rollInternal(chunkerConfig, totalSize, changeOffset, changeSize, 'modified', modifyDataSets, 'modify')

    if (totalSize > 1000) {
      const changeSizeSparse = 10
      const changeOffsetSparse = 100
      await rollInternal(chunkerConfig, totalSize, changeOffsetSparse, changeSizeSparse, 'modified sparse (skip 10 materials)', modifyDataSets, 'modify-sparse-10', 10)
      await rollInternal(chunkerConfig, totalSize, changeOffsetSparse, changeSizeSparse, 'modified sparse (skip 50 materials)', modifyDataSets, 'modify-sparse-50', 50)
      await rollInternal(chunkerConfig, totalSize, changeOffsetSparse, changeSizeSparse, 'modified sparse (skip 100 materials)', modifyDataSets, 'modify-sparse-100', 100)
    }
  }

  async function rollInternal(chunkerConfig, totalSize, changeOffset, changeSize, changeName, generate, divSuffix, sparsity = 1) {

    const { firstSet, secondSet } = generate(totalSize, changeOffset, changeSize, sparsity)

    await computeReuse({ firstSet, secondSet }, chunkerConfig, toBinaryJson, 'json', 'fastcdc');
    await computeReuse({ firstSet, secondSet }, chunkerConfig, toBinaryJson, 'json', 'buzhash');
    await computeReuse({ firstSet, secondSet }, chunkerConfig, toBinaryBase64, 'base64', 'fastcdc');
    await computeReuse({ firstSet, secondSet }, chunkerConfig, toBinaryBase64, 'base64', 'buzhash');
    await computeReuse({ firstSet, secondSet }, chunkerConfig, toBinaryPackr, 'packr', 'fastcdc');
    await computeReuse({ firstSet, secondSet }, chunkerConfig, toBinaryPackr, 'packr', 'buzhash');
    await computeReuse({ firstSet, secondSet }, chunkerConfig, toBinaryLz4, 'lz4', 'fastcdc');
    await computeReuse({ firstSet, secondSet }, chunkerConfig, toBinaryLz4, 'lz4', 'buzhash');
    await computeReuse({ firstSet, secondSet }, chunkerConfig, toBinaryPacko, 'packo', 'fastcdc');
    await computeReuse({ firstSet, secondSet }, chunkerConfig, toBinaryPacko, 'packo', 'buzhash');

    renderCategory(totalSize, changeSize, changeOffset, chunkerConfig, `${changeName}`, `plot${totalSize}-${divSuffix}`);
  }

  const setDone = (size) => {
    setLabel(`[Done]`, size)
  }

  const setRunning = (size) => {
    setLabel(`[...]`, size)
  }

  const perform = async (size, chunkerConfig) => {
    setRunning(size)
    await roll(size, chunkerConfig)
    setDone(size)
  }

  const setLabel = (label, size) => {
    switch (size) {
      case 30:
        setB30(label)
        break
      case 300:
        setB300(label)
        break
      case 1200:
        setB1200(label)
        break
      default: throw new Error(`unknown label for ${size}`)
    }
  }

  const cleanUp = () => {
    blocksDiff.current.clear()
    blocksReused.current.clear()
    totalBlocksAfter.current.clear()
    totalBlocksBefore.current.clear()
    reuseRatios.current.clear()
    bytesTotal.current.clear()
  }


  const toBinaryPacko = json => {
    const buf = pack(json)
    return pako.deflate(buf)
  }

  const toBinaryLz4 = json => {
    const buf = pack(json)
    return lz4.compress(buf)
  }

  const toBinaryPackr = json => {
    return pack(json)
  }

  const toBinaryBase64= json => {
    const jsonText = JSON.stringify(json)
    const buf = TEXT_ENCODER.encode(jsonText)
    const base64Str = b64.fromByteArray(buf)
    const buf2 = TEXT_ENCODER.encode(base64Str)
    return buf2
  }

  const toBinaryJson = json => {
    const jsonText = JSON.stringify(json)
    const buf = TEXT_ENCODER.encode(jsonText)
    return buf
  }

  const computeReuse = async ({ firstSet, secondSet }, chunkerConfig, toBinary, name, alg) => {

    const key = `${firstSet.length}-${name}-${alg}`

    const { encode } = codec()
    const { create } = chunkyStore()
    const { fastcdc, buzhash } = chunkerFactory(chunkerConfig)

    const buf1 = toBinary(firstSet)
    const buf2 = toBinary(secondSet)

    let chunk
    switch (alg) {
      case 'fastcdc':
        chunk = fastcdc
        break
      case 'buzhash':
        chunk = buzhash
        break
      default: throw new Error(`Unknown chunking alg ${alg}`)
    }

    const { root: r1, blocks: b1 } = await create({ buf: buf1, chunk, encode })
    const { root: r2, blocks: b2 } = await create({ buf: buf2, chunk, encode })


    const { before, total, over, diff, ratio } = compareBlocks(b1, b2)

    totalBlocksBefore.current.set(key, before.length)
    totalBlocksAfter.current.set(key, total.length)
    reuseRatios.current.set(key, ratio)
    blocksReused.current.set(key, over.length)
    blocksDiff.current.set(key, diff.length)
    bytesTotal.current.set(key, miB(buf2.byteLength))
  }


  function compareBlocks(b1, b2) {

    const c1 = b1.map(block => block.cid.toString())
    const c2 = b2.map(block => block.cid.toString())

    let over = c2.filter(x => c1.includes(x))
    let diff = c2.filter(x => !c1.includes(x))

    console.log(`Total ${c2.length}`)
    console.log(`Overlap ${over.length}`)
    console.log(`New blocks ${diff.length}`)
    const ratio = ((over.length / c2.length) * 100).toFixed(2)
    console.log(`Diff % ${ratio}`)

    return { before: c1, total: c2, over, diff, ratio }
  }

  const appendDataSets = (originalSize, changeOffset, changeSize) => {
    const firstSet = []
    for (let index = 0; index < originalSize; index++) {
      firstSet.push(simpleMaterialJson())
    }
    const secondSet = [...firstSet]

    for (let index = 0; index < changeSize; index++) {
      secondSet.push(simpleMaterialJson())
    }
    return { firstSet, secondSet }
  }

  const insertDataSets = (originalSize, changeOffset, changeSize, skipSize) => {
    const firstSet = []
    for (let index = 0; index < originalSize; index++) {
      firstSet.push(simpleMaterialJson())
    }
    const secondSet = [...firstSet]
    let cursor = changeOffset
    for (let index = 0; index < changeSize; index++) {
      secondSet.splice(cursor, 0, simpleMaterialJson())
      cursor += skipSize
    }
    return { firstSet, secondSet }
  }

  const modifyDataSets = (originalSize, changeOffset, changeSize, skipSize) => {
    const firstSet = []
    for (let index = 0; index < originalSize; index++) {
      firstSet.push(simpleMaterialJson())
    }
    const secondSet = [...firstSet]
    let cursor = changeOffset
    for (let index = 0; index < changeSize; index++) {
      secondSet[cursor] = simpleMaterialJson()
      cursor += skipSize
    }
    return { firstSet, secondSet }
  }

  const miB = (size) => {
    return (size / (1024 * 1024)).toFixed(2);
  }

  return (
    <div className="App">
      <span className="remote" onClick={() => perform(30, { fastAvgSize: 1024 * 16, buzMask: 14 })}>{b30}</span>
      <span className="remote" onClick={() => perform(300, { fastAvgSize: 1024 * 16, buzMask: 14 })}>{b300}</span>
      <span className="remote" onClick={() => perform(1200, { fastAvgSize: 1024 * 16, buzMask: 14 })}>{b1200}</span>

      <div id='plot30-append'></div>
      <div id='plot30-insert'></div>
      <div id='plot30-modify'></div>

      <div id='plot300-append'></div>
      <div id='plot300-insert'></div>
      <div id='plot300-modify'></div>

      <div id='plot1200-append'></div>
      <div id='plot1200-insert'></div>
      <div id='plot1200-modify'></div>
      <div id='plot1200-modify-sparse-10'></div>
      <div id='plot1200-modify-sparse-50'></div>
      <div id='plot1200-modify-sparse-100'></div>
    </div>
  );
}

export default App;



