(() => {
  const $ = id => document.getElementById(id);
  const { jsPDF } = window.jspdf;
  const KEY = 'jahStudioProjectV16';
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

  function isRasterImage(o){return o && o.type==='image' && o._element;}
  function rasterizeObject(o, callback){
    if(!o)return;
    const bounds=o.getBoundingRect(true,true);
    const cloneCanvas=new fabric.StaticCanvas(null,{width:Math.max(1,Math.ceil(bounds.width*4)),height:Math.max(1,Math.ceil(bounds.height*4)),backgroundColor:'transparent'});
    o.clone(c=>{
      c.set({left:-bounds.left*4,top:-bounds.top*4,scaleX:(c.scaleX||1)*4,scaleY:(c.scaleY||1)*4,angle:o.angle||0,originX:o.originX,originY:o.originY});
      cloneCanvas.add(c);cloneCanvas.renderAll();
      const url=cloneCanvas.toDataURL({format:'png',multiplier:1});
      callback(url,bounds);
      cloneCanvas.dispose();
    });
  }
  function replaceWithRaster(old,url,bounds,name){
    fabric.Image.fromURL(url,img=>{
      tag(img,name||old._jahName||'素材');
      img.set({left:bounds.left,top:bounds.top,originX:'left',originY:'top',scaleX:bounds.width/img.width,scaleY:bounds.height/img.height,angle:0,opacity:old.opacity??1});
      canvas.remove(old);canvas.add(img).setActiveObject(img);afterChange();
    });
  }

  let cropTarget=null,cropSource=null;
  function drawCropPreview(){
    if(!cropSource)return;const c=$('cropPreview'),ctx=c.getContext('2d');
    const iw=cropSource.width,ih=cropSource.height,scale=Math.min(c.width/iw,c.height/ih),dw=iw*scale,dh=ih*scale,ox=(c.width-dw)/2,oy=(c.height-dh)/2;
    ctx.clearRect(0,0,c.width,c.height);ctx.fillStyle='#ddd';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(cropSource,ox,oy,dw,dh);
    const l=+$('cropLeft').value/100,r=+$('cropRight').value/100,t=+$('cropTop').value/100,b=+$('cropBottom').value/100;
    const x=ox+dw*l,y=oy+dh*t,w=dw*(1-l-r),h=dh*(1-t-b);
    ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(ox,oy,dw,Math.max(0,y-oy));ctx.fillRect(ox,y,Math.max(0,x-ox),h);ctx.fillRect(x+w,y,Math.max(0,ox+dw-(x+w)),h);ctx.fillRect(ox,y+h,dw,Math.max(0,oy+dh-(y+h)));
    ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.strokeRect(x,y,w,h);
  }
  ['cropLeft','cropRight','cropTop','cropBottom'].forEach(id=>$(id).oninput=()=>{const label=id+'V';$(label).textContent=$(id).value+'%';drawCropPreview();});
  $('cropBtn').onclick=()=>{const o=active();if(!o){status('先に素材を選択してください。');return;}if(!isRasterImage(o)){status('トリミングは画像素材に使えます。SVGは先に黒ベタ化すると画像になります。');return;}cropTarget=o;cropSource=o._element;['cropLeft','cropRight','cropTop','cropBottom'].forEach(id=>{$(id).value=0;$(id+'V').textContent='0%';});drawCropPreview();$('cropDialog').showModal();};
  $('cancelCrop').onclick=()=>$('cropDialog').close();
  $('applyCrop').onclick=()=>{if(!cropTarget||!cropSource)return;const l=+$('cropLeft').value/100,r=+$('cropRight').value/100,t=+$('cropTop').value/100,b=+$('cropBottom').value/100;const sx=Math.round(cropSource.width*l),sy=Math.round(cropSource.height*t),sw=Math.max(1,Math.round(cropSource.width*(1-l-r))),sh=Math.max(1,Math.round(cropSource.height*(1-t-b)));const temp=document.createElement('canvas');temp.width=sw;temp.height=sh;temp.getContext('2d').drawImage(cropSource,sx,sy,sw,sh,0,0,sw,sh);const oldW=cropTarget.getScaledWidth(),oldH=cropTarget.getScaledHeight(),newW=oldW*(sw/cropSource.width),newH=oldH*(sh/cropSource.height);const left=(cropTarget.left||0)+oldW*l,top=(cropTarget.top||0)+oldH*t;const data=temp.toDataURL('image/png');fabric.Image.fromURL(data,img=>{tag(img,cropTarget._jahName||'トリミング画像');img.set({left,top,originX:'left',originY:'top',scaleX:newW/img.width,scaleY:newH/img.height,opacity:cropTarget.opacity??1});canvas.remove(cropTarget);canvas.add(img).setActiveObject(img);$('cropDialog').close();afterChange('トリミングを適用しました。');});};


  let vectorTarget=null,vectorTimer=null,lastVectorSvg='';

  function sourceCanvasFromImageObject(o,maxSide=1200){
    const img=o._element;
    const sw=img.naturalWidth||img.width,sh=img.naturalHeight||img.height;
    const scale=Math.min(1,maxSide/Math.max(sw,sh));
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(sw*scale));c.height=Math.max(1,Math.round(sh*scale));
    const ctx=c.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(img,0,0,c.width,c.height);
    return c;
  }

  function removeSmallBlackComponents(imageData,minSize){
    if(minSize<=0)return imageData;
    const {width:w,height:h,data}=imageData,seen=new Uint8Array(w*h),stack=[],component=[];
    const isBlack=i=>data[i*4+3]>0&&data[i*4]<128;
    for(let start=0;start<w*h;start++){
      if(seen[start]||!isBlack(start))continue;
      stack.length=0;component.length=0;stack.push(start);seen[start]=1;
      while(stack.length){
        const i=stack.pop();component.push(i);const x=i%w,y=(i/w)|0;
        if(x>0){const n=i-1;if(!seen[n]&&isBlack(n)){seen[n]=1;stack.push(n);}}
        if(x<w-1){const n=i+1;if(!seen[n]&&isBlack(n)){seen[n]=1;stack.push(n);}}
        if(y>0){const n=i-w;if(!seen[n]&&isBlack(n)){seen[n]=1;stack.push(n);}}
        if(y<h-1){const n=i+w;if(!seen[n]&&isBlack(n)){seen[n]=1;stack.push(n);}}
      }
      if(component.length<minSize){for(const i of component)data[i*4+3]=0;}
    }
    return imageData;
  }

  function makeBinaryImageData(source,threshold,noise){
    const ctx=source.getContext('2d',{willReadFrequently:true});
    const d=ctx.getImageData(0,0,source.width,source.height);
    for(let i=0;i<d.data.length;i+=4){
      const a=d.data[i+3],lum=.2126*d.data[i]+.7152*d.data[i+1]+.0722*d.data[i+2];
      if(a<16||lum>=threshold){d.data[i]=255;d.data[i+1]=255;d.data[i+2]=255;d.data[i+3]=0;}
      else{d.data[i]=0;d.data[i+1]=0;d.data[i+2]=0;d.data[i+3]=255;}
    }
    return removeSmallBlackComponents(d,noise);
  }

  function drawVectorPreview(){
    if(!vectorTarget)return;
    const preview=$('vectorPreview'),pctx=preview.getContext('2d');
    try{
      const source=sourceCanvasFromImageObject(vectorTarget,900);
      const d=makeBinaryImageData(source,+$('vectorThreshold').value,+$('vectorNoise').value);
      const tmp=document.createElement('canvas');tmp.width=d.width;tmp.height=d.height;tmp.getContext('2d').putImageData(d,0,0);
      pctx.clearRect(0,0,preview.width,preview.height);
      const sc=Math.min(preview.width/tmp.width,preview.height/tmp.height),dw=tmp.width*sc,dh=tmp.height*sc;
      pctx.drawImage(tmp,(preview.width-dw)/2,(preview.height-dh)/2,dw,dh);
      $('vectorStatus').textContent=`プレビュー ${d.width}×${d.height}px｜黒い部分がSVGになります。`;
    }catch(e){$('vectorStatus').textContent='プレビューの作成に失敗しました。';}
  }

  function scheduleVectorPreview(){clearTimeout(vectorTimer);vectorTimer=setTimeout(drawVectorPreview,100);}
  ['vectorThreshold','vectorNoise','vectorSmooth'].forEach(id=>$(id).oninput=()=>{$(id+'V').textContent=$(id).value;scheduleVectorPreview();});

  function buildVectorSvg(){
    if(!vectorTarget)throw new Error('画像が選択されていません。');
    if(!window.ImageTracer)throw new Error('ベクター化ライブラリを読み込めません。通信環境を確認してください。');
    const source=sourceCanvasFromImageObject(vectorTarget,1400);
    const imageData=makeBinaryImageData(source,+$('vectorThreshold').value,+$('vectorNoise').value);
    const smooth=+$('vectorSmooth').value;
    let svg=ImageTracer.imagedataToSVG(imageData,{
      ltres:1+smooth*.22,qtres:1+smooth*.22,pathomit:Math.max(0,+$('vectorNoise').value),
      rightangleenhance:true,colorsampling:0,numberofcolors:2,mincolorratio:0,colorquantcycles:1,
      strokewidth:0,linefilter:false,scale:1,roundcoords:2,viewbox:true,desc:false
    });
    svg=svg.replace(/<path[^>]*fill="rgb\(255,255,255\)"[^>]*\/?>/g,'')
           .replace(/<path[^>]*fill="rgb\(255, 255, 255\)"[^>]*\/?>/g,'')
           .replace(/fill="rgb\(0,0,0\)"/g,'fill="#000000"')
           .replace(/fill="rgb\(0, 0, 0\)"/g,'fill="#000000"');
    if(!/<path\b/i.test(svg))throw new Error('輪郭を検出できませんでした。しきい値を調整してください。');
    return svg;
  }

  $('vectorBtn').onclick=()=>{
    const o=active();
    if(!o){status('先に画像を選択してください。');return;}
    if(!isRasterImage(o)){status('ベクター化はPNG・JPEG画像に使えます。');return;}
    vectorTarget=o;lastVectorSvg='';$('vectorDialog').showModal();drawVectorPreview();
  };
  $('cancelVector').onclick=()=>{$('vectorDialog').close();vectorTarget=null;lastVectorSvg='';};
  $('saveVector').onclick=()=>{
    try{
      $('vectorStatus').textContent='SVGを作成中です…';lastVectorSvg=buildVectorSvg();
      const url=URL.createObjectURL(new Blob([lastVectorSvg],{type:'image/svg+xml'}));
      download(url,'JAH_STUDIO_vector.svg');setTimeout(()=>URL.revokeObjectURL(url),1500);
      $('vectorStatus').textContent='本物のSVGパスとして保存しました。';status('ベクターSVGを保存しました。');
    }catch(e){$('vectorStatus').textContent=e.message||'ベクター化に失敗しました。';}
  };
  $('applyVector').onclick=()=>{
    try{
      $('vectorStatus').textContent='ベクター化して配置中です…';
      const old=vectorTarget,svg=buildVectorSvg(),center=old.getCenterPoint(),w=old.getScaledWidth(),h=old.getScaledHeight(),angle=old.angle||0,opacity=old.opacity??1,name=(old._jahName||'素材')+' ベクター';
      fabric.loadSVGFromString(svg,(objects,options)=>{
        if(!objects||!objects.length){$('vectorStatus').textContent='SVGパスを作成できませんでした。';return;}
        const obj=fabric.util.groupSVGElements(objects,options);tag(obj,name);
        obj.set({left:center.x,top:center.y,originX:'center',originY:'center',angle,opacity,scaleX:w/obj.width,scaleY:h/obj.height});
        canvas.remove(old);canvas.add(obj).setActiveObject(obj);guideObjs.forEach(g=>canvas.bringToFront(g));
        $('vectorDialog').close();vectorTarget=null;lastVectorSvg='';afterChange('ベクター化を適用しました。SVG書き出しでもpathとして保存されます。');
      });
    }catch(e){$('vectorStatus').textContent=e.message||'ベクター化に失敗しました。';}
  };

  $('whiteBtn').onclick=()=>{const o=active();if(!o){status('先に素材を選択してください。');return;}if(!isRasterImage(o)){status('白抜きは画像素材に使えます。');return;}$('whiteDialog').showModal();};
  $('whiteThreshold').oninput=()=>$('whiteValue').textContent=$('whiteThreshold').value;
  $('cancelWhite').onclick=()=>$('whiteDialog').close();
  $('applyWhite').onclick=()=>{const o=active();if(!isRasterImage(o))return;const img=o._element,c=document.createElement('canvas');c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,c.width,c.height);const d=ctx.getImageData(0,0,c.width,c.height),th=+$('whiteThreshold').value;for(let i=0;i<d.data.length;i+=4){const r=d.data[i],g=d.data[i+1],b=d.data[i+2];if(r>=th&&g>=th&&b>=th){const closeness=(Math.min(r,g,b)-th)/(255-th);d.data[i+3]=Math.round(255*(1-closeness));}}ctx.putImageData(d,0,0);const url=c.toDataURL('image/png'),bounds=o.getBoundingRect(true,true);$('whiteDialog').close();replaceWithRaster(o,url,bounds,(o._jahName||'素材')+' 白抜き');status('白抜きを適用しました。');};

  function paintBlack(obj){
    if(obj.type==='group'&&obj.getObjects)obj.getObjects().forEach(paintBlack);
    if('fill' in obj&&obj.fill&&obj.fill!=='transparent')obj.set('fill','#000');
    if('stroke' in obj&&obj.stroke&&obj.stroke!=='transparent')obj.set('stroke','#000');
  }
  $('blackBtn').onclick=()=>{const o=active();if(!o){status('先に素材を選択してください。');return;}if(isRasterImage(o)){const img=o._element,c=document.createElement('canvas');c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,c.width,c.height);const d=ctx.getImageData(0,0,c.width,c.height);for(let i=0;i<d.data.length;i+=4){if(d.data[i+3]>0){d.data[i]=0;d.data[i+1]=0;d.data[i+2]=0;}}ctx.putImageData(d,0,0);replaceWithRaster(o,c.toDataURL('image/png'),o.getBoundingRect(true,true),(o._jahName||'素材')+' 黒ベタ');}else{paintBlack(o);canvas.requestRenderAll();afterChange('黒ベタ化しました。');}};
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

  function snapshot(){return JSON.stringify({version:'1.6',pageW,pageH,template:$('template').value,guides:$('guides').checked,grid:$('grid').checked,snap:$('snap').checked,json:canvas.toJSON(['_jahId','_jahName','excludeFromExport'])});}
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
  function objectOutsidePage(o){
    const b=o.getBoundingRect(true,true);
    return b.left<0||b.top<0||b.left+b.width>pageW||b.top+b.height>pageH;
  }
  function countSvgPaths(o){
    let n=0;
    const walk=x=>{if(!x)return;if(x.type==='path')n++;if(x.getObjects)x.getObjects().forEach(walk);};
    walk(o);return n;
  }
  function printDiagnostics(){
    const objs=userObjects(),rasters=objs.filter(isRasterImage),texts=objs.filter(o=>o.type==='text'||o.type==='textbox'||o.type==='i-text'),outside=objs.filter(objectOutsidePage),paths=objs.reduce((a,o)=>a+countSvgPaths(o),0);
    const lines=[];
    lines.push(`用紙：${pageW} × ${pageH} mm`);
    lines.push(`素材：${objs.length}個／ベクターパス：約${paths}個`);
    if(rasters.length)lines.push(`⚠ 画像素材 ${rasters.length}個：完全ベクターPDFにするには先にベクター化してください。`);else lines.push('✓ 画像素材なし：ベクターPDFに適した状態です。');
    if(texts.length)lines.push(`⚠ 文字 ${texts.length}個：PDFでは文字として保持されます。印刷店によってはアウトライン化を求められます。`);
    if(outside.length)lines.push(`⚠ 用紙外にはみ出す素材 ${outside.length}個があります。`);else lines.push('✓ 全素材が用紙内に収まっています。');
    if(paths>12000)lines.push('⚠ パス数が多いため、印刷ソフトで重くなる可能性があります。');
    const box=$('printCheck');box.textContent=lines.join('\n');box.className='print-check info '+(rasters.length||outside.length?'warn':'ok');
    return {rasters,texts,outside,paths};
  }
  $('exportPdf').onclick=()=>{$('pdfDialog').showModal();printDiagnostics();};
  $('cancelPdf').onclick=()=>$('pdfDialog').close();

  function cloneCanvasSvg(blackOnly=false){
    return withoutGuides(()=>{
      const prior=[];
      if(blackOnly){userObjects().forEach(o=>{prior.push([o,o.fill,o.stroke]);paintBlack(o);});canvas.requestRenderAll();}
      const svg=canvas.toSVG({width:pageW+'mm',height:pageH+'mm',viewBox:{x:0,y:0,width:pageW,height:pageH}});
      if(blackOnly){prior.forEach(([o,f,st])=>o.set({fill:f,stroke:st}));canvas.requestRenderAll();}
      return svg;
    });
  }

  async function exportVectorPdf(blackOnly=false){
    const diag=printDiagnostics();
    if(diag.rasters.length){
      const ok=confirm(`画像素材が${diag.rasters.length}個残っています。\nこの部分はPDF内で画像のままになります。\n続けますか？`);
      if(!ok)return;
    }
    status('ベクターPDFを作成中です…');
    const svgText=cloneCanvasSvg(blackOnly);
    const doc=new DOMParser().parseFromString(svgText,'image/svg+xml');
    const svgEl=doc.documentElement;
    const pdf=new jsPDF({orientation:pageW>pageH?'landscape':'portrait',unit:'mm',format:[pageW,pageH],compress:true,putOnlyUsedFonts:true});
    if(typeof pdf.svg!=='function')throw new Error('ベクターPDF機能を読み込めません。通信環境を確認してください。');
    await pdf.svg(svgEl,{x:0,y:0,width:pageW,height:pageH});
    pdf.save(blackOnly?'JAH_STUDIO_silk_vector.pdf':'JAH_STUDIO_vector_print.pdf');
    status(blackOnly?'黒1色ベクターPDFを書き出しました。':'ベクターPDFを書き出しました。');
  }
  function exportRasterPdf(){
    const img=withoutGuides(()=>canvas.toDataURL({format:'png',multiplier:4,enableRetinaScaling:true}));
    const pdf=new jsPDF({orientation:pageW>pageH?'landscape':'portrait',unit:'mm',format:[pageW,pageH],compress:true});
    pdf.addImage(img,'PNG',0,0,pageW,pageH,undefined,'FAST');pdf.save('JAH_STUDIO_raster_print.pdf');status('画像PDFを書き出しました。');
  }
  $('confirmPdf').onclick=async()=>{
    const mode=document.querySelector('input[name="pdfMode"]:checked')?.value||'vector';
    $('confirmPdf').disabled=true;
    try{if(mode==='raster')exportRasterPdf();else await exportVectorPdf(mode==='silk');$('pdfDialog').close();}
    catch(e){status(e.message||'PDF作成に失敗しました。');$('printCheck').textContent='エラー：'+(e.message||'PDF作成に失敗しました。');$('printCheck').className='print-check info bad';}
    finally{$('confirmPdf').disabled=false;}
  };

  addEventListener('resize',resizeCanvas);restore();
})();
