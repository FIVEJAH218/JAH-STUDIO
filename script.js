(() => {
  const $ = id => document.getElementById(id);
  const { jsPDF } = window.jspdf;
  const KEY = 'jahStudioProjectV13';
  const templates = {a3p:[297,420],a3l:[420,297],a4p:[210,297],b4p:[257,364],b5p:[182,257],leftchest:[100,100],sleeve:[90,300],senjafuda:[45,135]};
  let pageW=297,pageH=420,seq=1,guideObjs=[],saveTimer=null;
  let history=[],historyIndex=-1,historyBusy=false;
  const canvas=new fabric.Canvas('editor',{preserveObjectStacking:true,selection:true,backgroundColor:'#fff',allowTouchScrolling:false});

  const status=t=>$('status').textContent=t;
  const userObjects=()=>canvas.getObjects().filter(o=>!o.excludeFromExport);
  const active=()=>canvas.getActiveObject();
  const screenZoom=()=>Math.min(Math.min(innerWidth-52,560)/pageW,(innerWidth<760?560:680)/pageH,3.2);

  function resizeCanvas(){
    const z=screenZoom();
    canvas.setWidth(Math.round(pageW*z));canvas.setHeight(Math.round(pageH*z));canvas.setZoom(z);
    $('canvasWrap').style.width=canvas.getWidth()+'px';$('canvasWrap').style.height=canvas.getHeight()+'px';
    $('sizeLabel').textContent=`${pageW} × ${pageH} mm`;drawGuides();canvas.requestRenderAll();
  }
  function drawGuides(){
    guideObjs.forEach(o=>canvas.remove(o));guideObjs=[];
    if($('grid').checked){
      for(let x=10;x<pageW;x+=10)guideObjs.push(new fabric.Line([x,0,x,pageH],{stroke:'#ddd',strokeWidth:.25,selectable:false,evented:false,excludeFromExport:true}));
      for(let y=10;y<pageH;y+=10)guideObjs.push(new fabric.Line([0,y,pageW,y],{stroke:'#ddd',strokeWidth:.25,selectable:false,evented:false,excludeFromExport:true}));
    }
    if($('guides').checked){
      const c={stroke:'#00a4c7',strokeWidth:.35,selectable:false,evented:false,excludeFromExport:true};
      guideObjs.push(new fabric.Line([pageW/2,0,pageW/2,pageH],c),new fabric.Line([0,pageH/2,pageW,pageH/2],c));
      const m=Math.min(10,pageW*.06,pageH*.06);
      guideObjs.push(new fabric.Rect({left:m,top:m,width:pageW-m*2,height:pageH-m*2,fill:'transparent',stroke:'#e36b2c',strokeWidth:.35,strokeDashArray:[3,2],selectable:false,evented:false,excludeFromExport:true}));
    }
    guideObjs.forEach(g=>canvas.add(g));guideObjs.forEach(g=>canvas.sendToBack(g));
  }
  function applyTemplate(v,record=true){
    if(v!=='custom'){[pageW,pageH]=templates[v];$('docW').value=pageW;$('docH').value=pageH;}
    else {pageW=Math.max(10,+$('docW').value||297);pageH=Math.max(10,+$('docH').value||420);}
    resizeCanvas();if(record)recordHistory();scheduleSave();status(`テンプレートを ${pageW}×${pageH}mm に変更しました。`);
  }

  function tag(o,name){o._jahId='jah_'+seq++;o._jahName=name||'素材';o.set({transparentCorners:false,cornerColor:'#111',cornerStyle:'circle',borderColor:'#111',padding:2});return o;}
  function addRaster(url,name){fabric.Image.fromURL(url,img=>{tag(img,name);const s=Math.min((pageW*.65)/img.width,(pageH*.65)/img.height,1);img.set({left:pageW/2,top:pageH/2,originX:'center',originY:'center',scaleX:s,scaleY:s});canvas.add(img).setActiveObject(img);afterChange(`${name} を追加しました。`);});}
  function addSvg(text,name){fabric.loadSVGFromString(text,(objects,options)=>{const obj=fabric.util.groupSVGElements(objects,options);tag(obj,name);const s=Math.min((pageW*.65)/obj.width,(pageH*.65)/obj.height,1);obj.set({left:pageW/2,top:pageH/2,originX:'center',originY:'center',scaleX:s,scaleY:s});canvas.add(obj).setActiveObject(obj);afterChange(`${name} を追加しました。`);});}
  function afterChange(msg){refreshLayers();updateInfo();recordHistory();scheduleSave();if(msg)status(msg);}

  $('template').onchange=e=>applyTemplate(e.target.value);
  $('docW').onchange=()=>{$('template').value='custom';applyTemplate('custom');};
  $('docH').onchange=()=>{$('template').value='custom';applyTemplate('custom');};
  ['guides','grid'].forEach(id=>$(id).onchange=()=>{drawGuides();scheduleSave();});
  $('snap').onchange=scheduleSave;
  $('addImage').onclick=()=>$('imageInput').click();
  $('imageInput').onchange=e=>{[...e.target.files].forEach(file=>{const r=new FileReader();const svg=file.type==='image/svg+xml'||file.name.toLowerCase().endsWith('.svg');r.onload=ev=>svg?addSvg(ev.target.result,file.name):addRaster(ev.target.result,file.name);svg?r.readAsText(file):r.readAsDataURL(file);});e.target.value='';};
  $('addText').onclick=()=>$('textDialog').showModal();$('cancelText').onclick=()=>$('textDialog').close();
  $('confirmText').onclick=()=>{const t=$('textValue').value||'TEXT';const o=new fabric.Textbox(t,{left:pageW/2,top:pageH/2,originX:'center',originY:'center',width:pageW*.7,fontSize:18,fontFamily:$('fontFamily').value,fill:'#111',textAlign:'center'});tag(o,'文字: '+t);canvas.add(o).setActiveObject(o);$('textDialog').close();afterChange();};
  $('remove').onclick=()=>{const o=active();if(o){canvas.remove(o);afterChange();}};
  $('duplicate').onclick=()=>{const o=active();if(!o)return;o.clone(c=>{tag(c,(o._jahName||'素材')+' コピー');c.set({left:o.left+8,top:o.top+8});canvas.add(c).setActiveObject(c);afterChange();});};
  $('centerX').onclick=()=>{const o=active();if(o){o.set({left:pageW/2,originX:'center'});canvas.requestRenderAll();afterChange();}};
  $('centerY').onclick=()=>{const o=active();if(o){o.set({top:pageH/2,originY:'center'});canvas.requestRenderAll();afterChange();}};
  $('fit').onclick=()=>{const o=active();if(!o)return;const b=o.getBoundingRect(true,true),s=Math.min((pageW*.9)/b.width,(pageH*.9)/b.height);o.scaleX*=s;o.scaleY*=s;o.set({left:pageW/2,top:pageH/2,originX:'center',originY:'center'});canvas.requestRenderAll();afterChange();};
  $('front').onclick=()=>{const o=active();if(o){canvas.bringToFront(o);guideObjs.forEach(g=>canvas.bringToFront(g));afterChange();}};
  $('back').onclick=()=>{const o=active();if(o){canvas.sendToBack(o);guideObjs.forEach(g=>canvas.sendToBack(g));afterChange();}};
  $('opacity').oninput=()=>{const o=active();$('opacityValue').textContent=$('opacity').value+'%';if(o){o.set('opacity',+$('opacity').value/100);canvas.requestRenderAll();scheduleSave();}};
  $('applyObject').onclick=()=>{const o=active();if(!o)return;const cw=o.getScaledWidth(),ch=o.getScaledHeight(),tw=Math.max(.1,+$('objW').value||cw),th=Math.max(.1,+$('objH').value||ch);if($('lockRatio').value==='on'){const f=tw/cw;o.scaleX*=f;o.scaleY*=f;}else{o.scaleX*=tw/cw;o.scaleY*=th/ch;}o.set({left:+$('objX').value||0,top:+$('objY').value||0,originX:'left',originY:'top',angle:+$('objAngle').value||0});canvas.requestRenderAll();afterChange();};

  function updateInfo(){const o=active();if(!o){$('selectionInfo').textContent='素材を選択してください';['objW','objH','objX','objY','objAngle'].forEach(id=>$(id).value='');$('opacity').value=100;$('opacityValue').textContent='100%';return;}const w=o.getScaledWidth(),h=o.getScaledHeight();$('selectionInfo').textContent=`${o._jahName||o.type}｜横 ${w.toFixed(1)}mm × 縦 ${h.toFixed(1)}mm｜回転 ${Math.round(o.angle||0)}°`; $('objW').value=w.toFixed(1);$('objH').value=h.toFixed(1);$('objX').value=(o.left||0).toFixed(1);$('objY').value=(o.top||0).toFixed(1);$('objAngle').value=Math.round(o.angle||0);$('opacity').value=Math.round((o.opacity??1)*100);$('opacityValue').textContent=$('opacity').value+'%';}
  function refreshLayers(){const host=$('layers');host.innerHTML='';userObjects().slice().reverse().forEach(o=>{const row=document.createElement('div');row.className='layer'+(active()===o?' active':'');const name=document.createElement('button');name.className='name secondary';name.textContent=o._jahName||o.type;name.onclick=()=>{canvas.setActiveObject(o);canvas.requestRenderAll();refreshLayers();updateInfo();};const up=document.createElement('button');up.className='secondary';up.textContent='↑';up.onclick=()=>{canvas.bringForward(o);guideObjs.forEach(g=>canvas.bringToFront(g));afterChange();};const down=document.createElement('button');down.className='secondary';down.textContent='↓';down.onclick=()=>{canvas.sendBackwards(o);guideObjs.forEach(g=>canvas.bringToFront(g));afterChange();};const lock=document.createElement('button');lock.className='secondary';lock.textContent=o.selectable?'🔓':'🔒';lock.onclick=()=>{const v=o.selectable;o.set({selectable:!v,evented:!v});canvas.discardActiveObject();canvas.requestRenderAll();afterChange();};const del=document.createElement('button');del.className='danger';del.textContent='×';del.onclick=()=>{canvas.remove(o);afterChange();};row.append(name,up,down,lock,del);host.appendChild(row);});}
  function snapObject(o){if(!$('snap').checked)return;if(Math.abs(o.getCenterPoint().x-pageW/2)<4)o.set({left:pageW/2,originX:'center'});if(Math.abs(o.getCenterPoint().y-pageH/2)<4)o.set({top:pageH/2,originY:'center'});}

  function snapshot(){return JSON.stringify({version:'1.3',pageW,pageH,template:$('template').value,guides:$('guides').checked,grid:$('grid').checked,snap:$('snap').checked,json:canvas.toJSON(['_jahId','_jahName','excludeFromExport'])});}
  function recordHistory(){if(historyBusy)return;const s=snapshot();if(history[historyIndex]===s)return;history=history.slice(0,historyIndex+1);history.push(s);if(history.length>30)history.shift();historyIndex=history.length-1;updateHistoryButtons();}
  function updateHistoryButtons(){$('undo').disabled=historyIndex<=0;$('redo').disabled=historyIndex>=history.length-1;}
  function loadState(state){historyBusy=true;const d=JSON.parse(state);pageW=d.pageW;pageH=d.pageH;$('template').value=d.template||'custom';$('docW').value=pageW;$('docH').value=pageH;$('guides').checked=d.guides!==false;$('grid').checked=!!d.grid;$('snap').checked=d.snap!==false;canvas.loadFromJSON(d.json,()=>{resizeCanvas();refreshLayers();updateInfo();historyBusy=false;scheduleSave();updateHistoryButtons();});}
  $('undo').onclick=()=>{if(historyIndex>0){historyIndex--;loadState(history[historyIndex]);}};
  $('redo').onclick=()=>{if(historyIndex<history.length-1){historyIndex++;loadState(history[historyIndex]);}};

  canvas.on('object:moving',e=>snapObject(e.target));
  canvas.on('object:modified',()=>afterChange());
  canvas.on('selection:created',()=>{refreshLayers();updateInfo();});canvas.on('selection:updated',()=>{refreshLayers();updateInfo();});canvas.on('selection:cleared',()=>{refreshLayers();updateInfo();});canvas.on('object:added',refreshLayers);canvas.on('object:removed',refreshLayers);

  function saveNow(){try{localStorage.setItem(KEY,snapshot());status('自動保存しました。');}catch(e){status('保存容量が不足しています。');}}
  function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(saveNow,350);}
  $('saveProject').onclick=saveNow;$('clearProject').onclick=()=>{localStorage.removeItem(KEY);status('保存データを消去しました。');};
  function restore(){const raw=localStorage.getItem(KEY);if(!raw){applyTemplate('a3p',false);history=[snapshot()];historyIndex=0;updateHistoryButtons();return;}try{historyBusy=true;const d=JSON.parse(raw);pageW=d.pageW||297;pageH=d.pageH||420;$('template').value=d.template||'custom';$('docW').value=pageW;$('docH').value=pageH;$('guides').checked=d.guides!==false;$('grid').checked=!!d.grid;$('snap').checked=d.snap!==false;canvas.loadFromJSON(d.json,()=>{resizeCanvas();refreshLayers();updateInfo();historyBusy=false;history=[snapshot()];historyIndex=0;updateHistoryButtons();status('前回のプロジェクトを復元しました。');});}catch(e){historyBusy=false;applyTemplate('a3p',false);history=[snapshot()];historyIndex=0;updateHistoryButtons();}}

  function withoutGuides(fn){const old=guideObjs.map(g=>g.visible);guideObjs.forEach(g=>g.visible=false);canvas.discardActiveObject();canvas.requestRenderAll();try{return fn();}finally{guideObjs.forEach((g,i)=>g.visible=old[i]);canvas.requestRenderAll();}}
  function download(url,name){const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();}
  $('exportPng').onclick=()=>{download(withoutGuides(()=>canvas.toDataURL({format:'png',multiplier:4,enableRetinaScaling:true})),'JAH_STUDIO_design.png');status('PNGを書き出しました。');};
  $('exportSvg').onclick=()=>{const svg=withoutGuides(()=>canvas.toSVG({width:pageW+'mm',height:pageH+'mm',viewBox:{x:0,y:0,width:pageW,height:pageH}})),b=new Blob([svg],{type:'image/svg+xml'}),u=URL.createObjectURL(b);download(u,'JAH_STUDIO_design.svg');setTimeout(()=>URL.revokeObjectURL(u),1000);status('SVGを書き出しました。');};
  $('exportPdf').onclick=()=>{const img=withoutGuides(()=>canvas.toDataURL({format:'png',multiplier:4,enableRetinaScaling:true})),pdf=new jsPDF({orientation:pageW>pageH?'landscape':'portrait',unit:'mm',format:[pageW,pageH]});pdf.addImage(img,'PNG',0,0,pageW,pageH,undefined,'FAST');pdf.save('JAH_STUDIO_print.pdf');status('PDFを書き出しました。');};

  addEventListener('resize',resizeCanvas);restore();
})();
