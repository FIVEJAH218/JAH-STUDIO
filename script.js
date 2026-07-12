(() => {
  const $ = id => document.getElementById(id);
  const templates = {
    a3p:[297,420], a3l:[420,297], a4p:[210,297],
    b4p:[257,364], b5p:[182,257],
    leftchest:[100,100], sleeve:[90,300], senjafuda:[45,135]
  };

  let docW=297, docH=420, seq=1;
  let guides=[];

  const canvas = new fabric.Canvas('editor',{
    preserveObjectStacking:true,
    selection:true,
    backgroundColor:'#fff',
    allowTouchScrolling:false
  });

  function status(t){ $('status').textContent=t; }
  function zoomForScreen(){
    const maxW=Math.min(window.innerWidth-52,560);
    const maxH=window.innerWidth<760?560:680;
    return Math.min(maxW/docW,maxH/docH,3.2);
  }
  function resize(){
    const z=zoomForScreen();
    canvas.setWidth(Math.round(docW*z));
    canvas.setHeight(Math.round(docH*z));
    canvas.setZoom(z);
    $('canvasWrap').style.width=canvas.getWidth()+'px';
    $('canvasWrap').style.height=canvas.getHeight()+'px';
    $('sizeLabel').textContent=`${docW} × ${docH} mm`;
    drawGuides();
    canvas.requestRenderAll();
  }
  function drawGuides(){
    guides.forEach(o=>canvas.remove(o));
    guides=[];
    if($('grid').checked){
      for(let x=10;x<docW;x+=10)guides.push(new fabric.Line([x,0,x,docH],{stroke:'#ddd',strokeWidth:.25,selectable:false,evented:false,excludeFromExport:true}));
      for(let y=10;y<docH;y+=10)guides.push(new fabric.Line([0,y,docW,y],{stroke:'#ddd',strokeWidth:.25,selectable:false,evented:false,excludeFromExport:true}));
    }
    if($('guides').checked){
      const c={stroke:'#00a4c7',strokeWidth:.35,selectable:false,evented:false,excludeFromExport:true};
      guides.push(new fabric.Line([docW/2,0,docW/2,docH],c));
      guides.push(new fabric.Line([0,docH/2,docW,docH/2],c));
      const m=Math.min(10,docW*.06,docH*.06);
      guides.push(new fabric.Rect({left:m,top:m,width:docW-m*2,height:docH-m*2,fill:'transparent',stroke:'#e36b2c',strokeWidth:.35,strokeDashArray:[3,2],selectable:false,evented:false,excludeFromExport:true}));
    }
    guides.forEach(g=>canvas.add(g));
    guides.forEach(g=>canvas.sendToBack(g));
  }
  function applyTemplate(v){
    if(v!=='custom'){
      [docW,docH]=templates[v];
      $('docW').value=docW;
      $('docH').value=docH;
    }else{
      docW=Math.max(10,+$('docW').value||297);
      docH=Math.max(10,+$('docH').value||420);
    }
    resize();
    status(`テンプレートを ${docW}×${docH}mm に変更しました。`);
  }

  $('template').onchange=e=>applyTemplate(e.target.value);
  $('docW').onchange=()=>{$('template').value='custom';applyTemplate('custom');};
  $('docH').onchange=()=>{$('template').value='custom';applyTemplate('custom');};
  $('guides').onchange=drawGuides;
  $('grid').onchange=drawGuides;

  function tag(o,name){
    o._jahId='jah_'+seq++;
    o._jahName=name||'素材';
    o.set({transparentCorners:false,cornerColor:'#111',cornerStyle:'circle',borderColor:'#111',padding:2});
    return o;
  }

  $('addImage').onclick=()=>$('imageInput').click();
  $('imageInput').onchange=e=>{
    [...e.target.files].forEach(file=>{
      const r=new FileReader();
      r.onload=ev=>fabric.Image.fromURL(ev.target.result,img=>{
        tag(img,file.name||'画像');
        const s=Math.min((docW*.65)/img.width,(docH*.65)/img.height,1);
        img.set({left:docW/2,top:docH/2,originX:'center',originY:'center',scaleX:s,scaleY:s});
        canvas.add(img).setActiveObject(img);
        refreshLayers(); updateInfo();
        status(`${file.name} を追加しました。`);
      });
      r.readAsDataURL(file);
    });
    e.target.value='';
  };

  $('addText').onclick=()=>$('textDialog').showModal();
  $('cancelText').onclick=()=>$('textDialog').close();
  $('confirmText').onclick=()=>{
    const t=$('textValue').value||'TEXT';
    const o=new fabric.Textbox(t,{left:docW/2,top:docH/2,originX:'center',originY:'center',width:docW*.7,fontSize:18,fontFamily:$('fontFamily').value,fill:'#111',textAlign:'center'});
    tag(o,'文字: '+t);
    canvas.add(o).setActiveObject(o);
    $('textDialog').close();
    refreshLayers(); updateInfo();
  };

  const active=()=>canvas.getActiveObject();

  $('remove').onclick=()=>{const o=active();if(o){canvas.remove(o);refreshLayers();updateInfo();}};
  $('duplicate').onclick=()=>{const o=active();if(!o)return;o.clone(c=>{tag(c,(o._jahName||'素材')+' コピー');c.set({left:o.left+8,top:o.top+8});canvas.add(c).setActiveObject(c);refreshLayers();updateInfo();});};
  $('centerX').onclick=()=>{const o=active();if(o){o.set({left:docW/2,originX:'center'});canvas.requestRenderAll();updateInfo();}};
  $('centerY').onclick=()=>{const o=active();if(o){o.set({top:docH/2,originY:'center'});canvas.requestRenderAll();updateInfo();}};
  $('fit').onclick=()=>{const o=active();if(!o)return;const b=o.getBoundingRect(true,true);const s=Math.min((docW*.9)/b.width,(docH*.9)/b.height);o.scaleX*=s;o.scaleY*=s;o.set({left:docW/2,top:docH/2,originX:'center',originY:'center'});canvas.requestRenderAll();updateInfo();};
  $('front').onclick=()=>{const o=active();if(o){canvas.bringToFront(o);guides.forEach(g=>canvas.bringToFront(g));refreshLayers();}};
  $('forward').onclick=()=>{const o=active();if(o){canvas.bringForward(o);guides.forEach(g=>canvas.bringToFront(g));refreshLayers();}};
  $('backward').onclick=()=>{const o=active();if(o){canvas.sendBackwards(o);guides.forEach(g=>canvas.bringToFront(g));refreshLayers();}};

  $('opacity').oninput=()=>{const o=active();$('opacityValue').textContent=$('opacity').value+'%';if(o){o.set('opacity',+$('opacity').value/100);canvas.requestRenderAll();}};

  function userObjects(){return canvas.getObjects().filter(o=>!o.excludeFromExport);}
  function updateInfo(){
    const o=active();
    if(!o){$('selectionInfo').textContent='素材を選択してください';$('opacity').value=100;$('opacityValue').textContent='100%';return;}
    $('selectionInfo').textContent=`${o._jahName||o.type}｜横 ${o.getScaledWidth().toFixed(1)}mm × 縦 ${o.getScaledHeight().toFixed(1)}mm｜回転 ${Math.round(o.angle||0)}°`;
    $('opacity').value=Math.round((o.opacity??1)*100);
    $('opacityValue').textContent=$('opacity').value+'%';
  }
  function refreshLayers(){
    const host=$('layers');host.innerHTML='';
    userObjects().slice().reverse().forEach(o=>{
      const row=document.createElement('div');row.className='layer'+(active()===o?' active':'');
      const name=document.createElement('button');name.className='name secondary';name.textContent=o._jahName||o.type;name.onclick=()=>{canvas.setActiveObject(o);canvas.requestRenderAll();refreshLayers();updateInfo();};
      const up=document.createElement('button');up.className='secondary';up.textContent='↑';up.onclick=()=>{canvas.bringForward(o);guides.forEach(g=>canvas.bringToFront(g));refreshLayers();};
      const down=document.createElement('button');down.className='secondary';down.textContent='↓';down.onclick=()=>{canvas.sendBackwards(o);guides.forEach(g=>canvas.bringToFront(g));refreshLayers();};
      const lock=document.createElement('button');lock.className='secondary';lock.textContent=o.selectable?'🔓':'🔒';lock.onclick=()=>{const v=o.selectable;o.set({selectable:!v,evented:!v});canvas.discardActiveObject();canvas.requestRenderAll();refreshLayers();updateInfo();};
      row.append(name,up,down,lock);host.appendChild(row);
    });
  }
  function snap(o){
    if(!$('snap').checked)return;
    if(Math.abs(o.getCenterPoint().x-docW/2)<4)o.set({left:docW/2,originX:'center'});
    if(Math.abs(o.getCenterPoint().y-docH/2)<4)o.set({top:docH/2,originY:'center'});
  }
  canvas.on('object:moving',e=>snap(e.target));
  canvas.on('object:modified',()=>{refreshLayers();updateInfo();});
  canvas.on('selection:created',()=>{refreshLayers();updateInfo();});
  canvas.on('selection:updated',()=>{refreshLayers();updateInfo();});
  canvas.on('selection:cleared',()=>{refreshLayers();updateInfo();});
  canvas.on('object:added',refreshLayers);
  canvas.on('object:removed',refreshLayers);

  function withoutGuides(fn){
    const old=guides.map(g=>g.visible);
    guides.forEach(g=>g.visible=false);
    canvas.discardActiveObject();canvas.requestRenderAll();
    try{return fn();}finally{guides.forEach((g,i)=>g.visible=old[i]);canvas.requestRenderAll();}
  }
  function download(url,name){const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();}
  $('exportPng').onclick=()=>{download(withoutGuides(()=>canvas.toDataURL({format:'png',multiplier:4,enableRetinaScaling:true})),'JAH_STUDIO_design.png');status('PNGを書き出しました。');};
  $('exportSvg').onclick=()=>{const svg=withoutGuides(()=>canvas.toSVG({width:docW+'mm',height:docH+'mm',viewBox:{x:0,y:0,width:docW,height:docH}}));const b=new Blob([svg],{type:'image/svg+xml'});const u=URL.createObjectURL(b);download(u,'JAH_STUDIO_design.svg');setTimeout(()=>URL.revokeObjectURL(u),1000);status('SVGを書き出しました。');};
  $('saveProject').onclick=()=>{localStorage.setItem('jahStudioProjectV11',JSON.stringify({docW,docH,json:canvas.toJSON(['_jahId','_jahName','excludeFromExport'])}));status('このiPhone内に保存しました。');};

  window.addEventListener('resize',resize);
  applyTemplate('a3p');
})();
