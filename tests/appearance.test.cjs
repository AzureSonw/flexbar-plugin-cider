const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { Canvas, loadImage, FontLibrary } = require('skia-canvas')
const { appearance, loadAppearance, renderer } = require('./support.cjs')
const render = renderer()

test('auto-hide uses an explicit boolean and strict numeric whole-second defaults', () => {
  for(const value of [undefined,null,false,0,1,'true','false',{},[]]) assert.equal(appearance.normalizeAppearance({autoHidePlayPauseOverlay:value}).autoHidePlayPauseOverlay,false)
  assert.equal(appearance.normalizeAppearance({autoHidePlayPauseOverlay:true}).autoHidePlayPauseOverlay,true)
  for(const value of [1,3,5,30]) assert.equal(appearance.normalizeAppearance({playPauseOverlayHideDelaySeconds:value}).playPauseOverlayHideDelaySeconds,value)
  for(const value of [undefined,null,false,true,0,31,-1,2.5,NaN,Infinity,'5','',{},[]]) assert.equal(appearance.normalizeAppearance({playPauseOverlayHideDelaySeconds:value}).playPauseOverlayHideDelaySeconds,3)
})
const key = width => ({ width, style: { width, iconSize:42, fontSize:24 } })
const track = state => ({ title:'夜曲 · アイドル · 좋은 날 👩🏽‍🚀', artist:'周杰伦 · YOASOBI · 아이유', progress:{currentTime:50,duration:100,state} })
async function artwork(color) {
  const canvas = new Canvas(160,80); canvas.gpu=false
  const context=canvas.getContext('2d'); context.fillStyle=color; context.fillRect(0,0,160,80)
  return canvas.toDataURL('png')
}
async function pixels(data) {
  const image=await loadImage(data), canvas=new Canvas(image.width,image.height); canvas.gpu=false
  const context=canvas.getContext('2d'); context.drawImage(image,0,0)
  return context
}

test('legacy and malformed appearance settings have safe defaults', () => {
  const expected={showPlayPauseOverlay:true,autoHidePlayPauseOverlay:false,playPauseOverlayHideDelaySeconds:3,timelineColor:'#ffffff',fontFamily:'',fontSize:null}
  for(const config of [undefined,null,{}, {ciderToken:'fixture'}, {showPlayPauseOverlay:'false',timelineColor:'#fff',fontFamily:42}]) {
    assert.deepEqual(appearance.normalizeAppearance(config),expected)
  }
  for(const color of ['', '#12gg34', '#000000ff', 'red', null, 123, {}, []]) {
    assert.equal(appearance.normalizeAppearance({timelineColor:color}).timelineColor,'#ffffff')
  }
  assert.deepEqual(appearance.normalizeAppearance({showPlayPauseOverlay:false,timelineColor:' #00FF88 ',fontFamily:'Cider nonexistent font 847193'}),
    {...expected,showPlayPauseOverlay:false,timelineColor:'#00ff88'})
})

test('font size accepts whole pixels in range and defaults to the saved key size otherwise', () => {
  for(const value of [12,18,24,30,'12','26','30']) assert.equal(appearance.normalizeAppearance({fontSize:value}).fontSize,Number(value))
  for(const value of [undefined,null,'',false,true,[],{},11,31,20.5,'24px',NaN,Infinity]) assert.equal(appearance.normalizeAppearance({fontSize:value}).fontSize,null)
})

test('font enumeration uses Skia families, filters data, and validates saved selections with has', () => {
  const requested=[]
  const helper=loadAppearance({families:['Zulu','Font With Spaces','Alpha','Zulu','',null,42,'   '],has:name=>{requested.push(name);return name==='Font With Spaces'}})
  assert.deepEqual(helper.getAvailableFontFamilies(),['Alpha','Font With Spaces','Zulu'])
  assert.equal(helper.normalizeAppearance({fontFamily:'Font With Spaces'}).fontFamily,'Font With Spaces')
  assert.equal(helper.normalizeAppearance({fontFamily:'Unavailable'}).fontFamily,'')
  assert.deepEqual(requested,['Font With Spaces','Unavailable'])
  const broken=loadAppearance({get families(){throw Error('font service unavailable')},has(){throw Error('font service unavailable')}})
  assert.throws(()=>broken.getAvailableFontFamilies())
  assert.equal(broken.getFontStack('Unavailable'),appearance.FONT_STACK)
})

test('font strings quote family data safely and retain the complete multilingual fallback', () => {
  const name='A "quoted" \\ family\nnext'
  const helper=loadAppearance({has:value=>value===name})
  assert.equal(helper.getFontStack(name),'"A \\"quoted\\" \\\\ family\\a next", '+appearance.FONT_STACK)
  assert.equal(appearance.getFontStack(''),appearance.FONT_STACK)
  assert.equal(appearance.getFontStack('Cider nonexistent font 847193'),appearance.FONT_STACK)
})

for(const background of ['#ffffff','#080808','#eeb090']) {
  test(`overlay state/toggle pixels remain confined to the actual cover on ${background}`, async () => {
    const art=await artwork(background)
    for(const width of [1,2,7,16,30,59,68,300,480]) {
      const base=await pixels(await render({...track('playing'),artwork:art},key(width),{showPlayPauseOverlay:false}))
      const baseline=base.getImageData(0,0,width,60).data
      const rendered={}
      for(const state of ['playing','paused','stopped','invalid',undefined]) {
        for(const showPlayPauseOverlay of [true,false]) {
          const current=(await pixels(await render({...track(state),artwork:art},key(width),{showPlayPauseOverlay}))).getImageData(0,0,width,60).data
          if(!showPlayPauseOverlay||!['playing','paused'].includes(state)||width<=2) assert.deepEqual(current,baseline)
          else {
            assert.notDeepEqual(current,baseline)
            const coverSize=({7:4,16:10,30:21,59:49})[width]??58,top=(60-coverSize)/2
            for(let y=0;y<60;y++) for(let x=0;x<width;x++) {
              if(x<1 || x>=1+coverSize || y<Math.floor(top) || y>=Math.ceil(top+coverSize)) {
                const index=(y*width+x)*4
                assert.deepEqual(current.subarray(index,index+4),baseline.subarray(index,index+4),`overlay leaked at ${x},${y}`)
              }
            }
            rendered[state]=current
          }
        }
      }
      if(width>=16) assert.notDeepEqual(rendered.playing,rendered.paused)
    }
  })
}

test('overlay centers and scales with actual artwork; text font cannot change icon geometry', async () => {
  const operations=[]
  class RecordingCanvas extends Canvas {
    getContext(type) {
      const context=super.getContext(type)
      return new Proxy(context,{
        set(target,name,value){target[name]=value;return true},
        get(target,name){
          const value=target[name]
          if(['translate','moveTo','lineTo','roundRect','arc','rect'].includes(name)) return (...args)=>{operations.push({name,args});return value.apply(target,args)}
          return typeof value==='function'?value.bind(target):value
        },
      })
    }
  }
  const draw=renderer(RecordingCanvas)
  for(const [width,iconSize,coverSize] of [[300,42,58],[300,24,40],[30,42,21],[7,42,4]]) {
    const size=Math.min(36,coverSize*.68),s=size/24,k={width,style:{width,iconSize}}
    for(const state of ['playing','paused']) {
      operations.length=0;await draw(track(state),k)
      assert.equal(operations.filter(o=>o.name==='arc').length,0,'overlay must not have a circular backdrop')
      assert.deepEqual(operations.find(o=>o.name==='translate').args,[1+coverSize/2,30])
      assert.deepEqual(operations.find(o=>o.name==='rect').args,[1,(60-coverSize)/2,coverSize,coverSize])
      if(state==='paused') assert.deepEqual(operations.filter(o=>['moveTo','lineTo'].includes(o.name)).map(o=>o.args),[[-5*s,-8*s],[7*s,0],[-5*s,8*s]])
      else assert.deepEqual(operations.filter(o=>o.name==='roundRect').map(o=>o.args),[[-5*s,-8*s,4*s,16*s,2*s],[s,-8*s,4*s,16*s,2*s]])
    }
  }
})

test('four timeline colors change only played pixels; invalid colors fall back to white', async () => {
  const art=await artwork('#997744')
  for(const width of [180,300,480,800]) for(const timelineColor of ['#ffffff','#ff0000','#00ff88','#0088ff','invalid']) {
    const context=await pixels(await render({...track('playing'),artwork:art},key(width),{timelineColor}))
    const start=104,span=width-45-start,played=span/2
    const color=appearance.normalizeAppearance({timelineColor}).timelineColor
    const rgb=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16))
    for(const y of [50,51,52]) {
      assert.deepEqual([...context.getImageData(start,y,1,1).data],[...rgb,255])
      assert.deepEqual([...context.getImageData(start+Math.ceil(played),y,1,1).data],[64,64,64,255])
    }
    assert.deepEqual([...context.getImageData(start,53,span,1).data].filter((_,i)=>i%4!==3),Array(span*3).fill(0))
    const off=await pixels(await render({...track('playing'),artwork:art},key(width),{timelineColor,showPlayPauseOverlay:false}))
    assert.deepEqual(context.getImageData(start,50,span,3).data,off.getImageData(start,50,span,3).data)
    const white=await pixels(await render({...track('playing'),artwork:art},key(width)))
    assert.deepEqual(context.getImageData(0,0,60,60).data,white.getImageData(0,0,60,60).data)
  }
})

test('real installed fonts render Unicode and grapheme-safe ellipsis without changing layout or cover', async () => {
  const families=appearance.getAvailableFontFamilies()
  assert.ok(families.length)
  assert.ok(families.every(name=>typeof name==='string'&&name.trim()&&FontLibrary.has(name)))
  assert.equal(new Set(families).size,families.length)
  assert.deepEqual(families,[...families].sort((a,b)=>a.localeCompare(b)))
  const samples=[...new Set(['',...['Segoe UI','Microsoft YaHei'].filter(name=>families.includes(name)),...families.filter(name=>name.includes(' ')).slice(0,3)])]
  const text=[]
  class RecordingCanvas extends Canvas {
    getContext(type) {
      const context=super.getContext(type)
      return new Proxy(context,{
        set(target,name,value){target[name]=value;return true},
        get(target,name){
          if(name==='fillText') return (value,x,y)=>{text.push({value,x,y,font:target.font,align:target.textAlign,width:target.measureText(value).width});target.fillText(value,x,y)}
          const value=target[name];return typeof value==='function'?value.bind(target):value
        },
      })
    }
  }
  const draw=renderer(RecordingCanvas),art=await artwork('#f0b0a0'),sourceTrack={...track('playing'),artwork:art}
  const base=await pixels(await draw(sourceTrack,key(480)))
  for(const fontFamily of [...samples,'Cider nonexistent font 847193']) {
    for(const title of ['中文歌曲的长标题'.repeat(8),'日本語の歌とアーティスト'.repeat(8),'한국어 노래와 가수'.repeat(8),'👩🏽‍🚀👨‍👩‍👧‍👦🏳️‍🌈'.repeat(20)]) {
      text.length=0
      const context=await pixels(await draw({...sourceTrack,title,artist:title},key(480),{fontFamily}))
      assert.deepEqual(text.map(t=>[t.x,t.y,t.align]),[[266,15,'center'],[266,34,'center']])
      assert.match(text[0].font,/24px /);assert.match(text[1].font,/20px /)
      assert.ok(text.every(t=>t.value&&t.width<=412))
      const prefixes=new Set(['',...[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(title)].map(s=>title.slice(0,s.index+s.segment.length))])
      for(const t of text) assert.ok(prefixes.has(t.value.endsWith('…')?t.value.slice(0,-1):t.value),'ellipsis split a grapheme')
      assert.deepEqual(context.getImageData(0,0,60,60).data,base.getImageData(0,0,60,60).data)
      if(fontFamily==='Cider nonexistent font 847193') {
        const fallback=await pixels(await draw({...sourceTrack,title,artist:title},key(480)))
        assert.deepEqual(context.getImageData(0,0,480,60).data,fallback.getImageData(0,0,480,60).data)
      }
    }
  }
})

test('font size changes only text, preserves per-key defaults, and fits larger titles above the timeline', async () => {
  const text=[]
  class RecordingCanvas extends Canvas {
    getContext(type) {
      const context=super.getContext(type)
      return new Proxy(context,{
        set(target,name,value){target[name]=value;return true},
        get(target,name){
          if(name==='fillText') return (value,x,y)=>{
            const bounds=target.measureText(value)
            text.push({font:target.font,x,y,top:y-bounds.actualBoundingBoxAscent,bottom:y+bounds.actualBoundingBoxDescent,width:bounds.width})
            target.fillText(value,x,y)
          }
          const value=target[name];return typeof value==='function'?value.bind(target):value
        },
      })
    }
  }
  const draw=renderer(RecordingCanvas),art=await artwork('#997744'),t={...track('playing'),artwork:art}
  const k=key(480),original=structuredClone(k),base=await pixels(await draw(t,k))
  for(const fontSize of [12,18,24,26,30]) {
    text.length=0
    const current=await pixels(await draw(t,k,{fontSize}))
    assert.match(text[0].font,new RegExp(`\\b${fontSize}px `))
    assert.ok(text.every(line=>line.width<=412))
    if(fontSize>24) {
      assert.ok(text[0].top>=0);assert.ok(text[0].bottom<=text[1].top+1e-6,'title and artist must not overlap')
      assert.ok(text[1].bottom<=48+1e-6,`large fonts must leave space above the timeline: ${JSON.stringify({fontSize,text})}`)
    } else assert.deepEqual(text.map(line=>line.y),[15,34])
    assert.deepEqual(current.getImageData(0,0,60,60).data,base.getImageData(0,0,60,60).data)
    assert.deepEqual(current.getImageData(104,50,331,3).data,base.getImageData(104,50,331,3).data)
    assert.deepEqual(k,original)
  }
  k.style.fontSize=18;text.length=0;await draw(t,k)
  assert.match(text[0].font,/\b18px /)
  text.length=0;await draw(t,k,{fontSize:null})
  assert.match(text[0].font,/\b18px /)
})

const settingsSource=fs.readFileSync(path.join(__dirname,'../com.sonw.cider.plugin/ui/global_config.vue'),'utf8')
const component=new Function(settingsSource.match(/<script>([\s\S]*?)<\/script>/)[1].replace('export default','return'))()

test('auto-hide controls disable with the master and delay also disables without auto-hide', () => {
  for(const [model,tag,dependsOnAuto] of [['autoHidePlayPauseOverlay','v-switch',false],['playPauseOverlayHideDelaySeconds','v-text-field',true]]) {
    const control=settingsSource.match(new RegExp(`<${tag}\\s+v-model="${model}"[\\s\\S]*?/>`))[0]
    const disabled=new Function('busy','loading','showPlayPauseOverlay','autoHidePlayPauseOverlay','return '+control.match(/:disabled="([^"]+)"/)[1])
    for(const master of [true,false])for(const auto of [true,false]) {
      assert.equal(disabled(false,false,master,auto),!master||(dependsOnAuto&&!auto))
      assert.equal(disabled(true,false,master,auto),true);assert.equal(disabled(false,true,master,auto),true)
    }
    if(dependsOnAuto) assert.match(control,/suffix="seconds"/)
  }
})

test('delay UI saves numeric seconds and normalizes malformed entries', async () => {
  const store={config:{ciderToken:'fixture-token'},saves:0}
  const page=settingsPage(store,async()=>({success:true,fonts:[]}));await page.open()
  for(const [input,expected] of [['5',5],['30',30],['1',1],['',3],['2.5',3],['31',3],[null,3],[true,3]]) {
    page.vm.playPauseOverlayHideDelaySeconds=input;await page.vm.saveSettings()
    assert.equal(store.config.playPauseOverlayHideDelaySeconds,expected)
    assert.equal(page.vm.playPauseOverlayHideDelaySeconds,expected)
    assert.equal(store.config.ciderToken,'fixture-token')
  }
})
function settingsPage(store,send) {
  const vm={...component.data(),modelValue:{},$fd:{getConfig:async()=>structuredClone(store.config),setConfig:async config=>{store.config=structuredClone(config);store.saves++;return {status:'success'}},sendToBackend:send}}
  for(const [name,method] of Object.entries(component.methods))vm[name]=method.bind(vm)
  for(const [name,get] of Object.entries(component.computed))Object.defineProperty(vm,name,{get:get.bind(vm)})
  return {vm,open:()=>component.mounted.call(vm)}
}

test('one Save persists appearance and token, preserves unrelated config, and survives page/backend recreation', async () => {
  const fonts=appearance.getAvailableFontFamilies(),chosen=fonts.find(name=>name.includes(' '))||fonts[0]
  const store={config:{ciderToken:'fixture-token',unrelated:{keep:true}},saves:0},requests=[]
  const send=async payload=>{requests.push(payload);return payload.data==='cider-list-fonts'?{success:true,fonts}:{success:true}}
  let page=settingsPage(store,send);await page.open()
  assert.equal(page.vm.showPlayPauseOverlay,true);assert.equal(page.vm.fontFamily,'')
  assert.deepEqual(page.vm.fontItems[0],{title:'System Default',value:''})
  assert.equal(page.vm.fontSize,null)
  assert.equal(page.vm.autoHidePlayPauseOverlay,false);assert.equal(page.vm.playPauseOverlayHideDelaySeconds,3)
  page.vm.autoHidePlayPauseOverlay=true;page.vm.playPauseOverlayHideDelaySeconds='5'
  page.vm.showPlayPauseOverlay=false;page.vm.timelineColor='#00FF88';page.vm.fontFamily=chosen;page.vm.fontSize='22'
  store.config.newUnrelated='preserve latest'
  await page.vm.testConnection();assert.equal(store.saves,0)
  assert.deepEqual(requests.at(-1),{data:'cider-test-connection',ciderToken:'fixture-token'})
  await page.vm.saveSettings();assert.equal(store.saves,1)
  assert.deepEqual(store.config,{ciderToken:'fixture-token',unrelated:{keep:true},newUnrelated:'preserve latest',showPlayPauseOverlay:false,autoHidePlayPauseOverlay:true,playPauseOverlayHideDelaySeconds:5,timelineColor:'#00ff88',fontFamily:chosen,fontSize:22})
  for(let i=0;i<2;i++) {
    page=settingsPage(store,send);await page.open()
    assert.equal(page.vm.showPlayPauseOverlay,false);assert.equal(page.vm.timelineColor,'#00ff88');assert.equal(page.vm.fontFamily,chosen)
    assert.equal(page.vm.fontSize,22)
    assert.equal(page.vm.autoHidePlayPauseOverlay,true);assert.equal(page.vm.playPauseOverlayHideDelaySeconds,5)
    assert.deepEqual(loadAppearance().normalizeAppearance(store.config),{showPlayPauseOverlay:false,autoHidePlayPauseOverlay:true,playPauseOverlayHideDelaySeconds:5,timelineColor:'#00ff88',fontFamily:chosen,fontSize:22})
  }
  page.vm.showPlayPauseOverlay=true;await page.vm.saveSettings()
  page=settingsPage(store,send);await page.open();assert.equal(page.vm.showPlayPauseOverlay,true)
  assert.equal(store.config.ciderToken,'fixture-token')
  page.vm.fontSize=null;await page.vm.saveSettings()
  page=settingsPage(store,send);await page.open();assert.equal(page.vm.fontSize,null)
})

test('font failure or removed font leaves System Default and working token controls', async () => {
  for(const response of [{success:false,fonts:[]}, {success:true,fonts:[]}, null]) {
    const store={config:{ciderToken:'fixture-token',fontFamily:'removed font'},saves:0}
    const page=settingsPage(store,async p=>{if(p.data==='cider-test-connection')return {success:true};if(response===null)throw Error('offline');return response})
    await page.open()
    assert.equal(page.vm.loading,false);assert.equal(page.vm.fontsLoading,false);assert.equal(page.vm.fontFamily,'')
    assert.deepEqual(page.vm.fontItems,[{title:'System Default',value:''}])
    await page.vm.testConnection();assert.equal(page.vm.message,'Connected to Cider')
    page.vm.timelineColor='invalid';await page.vm.saveSettings()
    assert.equal(store.config.timelineColor,'#ffffff');assert.equal(store.config.ciderToken,'fixture-token')
  }
})

test('saving while fonts load preserves the saved family; load/save failures do not claim success', async () => {
  const chosen=appearance.getAvailableFontFamilies()[0],store={config:{ciderToken:'fixture-token',fontFamily:chosen},saves:0}
  let resolve
  const page=settingsPage(store,()=>new Promise(r=>{resolve=r})),opening=page.open()
  await new Promise(r=>setImmediate(r));await page.vm.saveSettings()
  assert.equal(store.config.fontFamily,chosen)
  resolve({success:true,fonts:[chosen]});await opening
  page.vm.$fd.setConfig=async()=>({status:'error'})
  await page.vm.saveSettings();assert.equal(page.vm.messageType,'error')
  const failed=settingsPage(store,async()=>({success:true,fonts:[]}))
  failed.vm.$fd.getConfig=async()=>{throw Error('unavailable')}
  await failed.open();assert.equal(failed.vm.loading,true);assert.equal(failed.vm.messageType,'error')
})
