(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[405],{8312:function(e,t,n){(window.__NEXT_P=window.__NEXT_P||[]).push(["/",function(){return n(5970)}])},5970:function(e,t,n){"use strict";n.r(t),n.d(t,{default:function(){return a}});var r=n(5893),o=n(7294),l=n(9008),i=n.n(l);function a(){let[e,t]=(0,o.useState)("http://via.placeholder.com/1200x1200"),[n,l]=(0,o.useState)("Filmclub Podcast"),[a,s]=(0,o.useState)("00"),c=async()=>{let e="https://api.themoviedb.org/3/search/movie?api_key=15d2ea6d0dc1d476efbca3eba2b9bbfb&query="+encodeURIComponent(n),t=await fetch(e),r=await t.json();if(0==r.total_results)return"http://via.placeholder.com/1200x1200";{let e=r.results[0].backdrop_path;return"https://image.tmdb.org/t/p/original"+e}},d=e=>{let t=window.open("/api/og?title="+encodeURIComponent(n)+"&number="+encodeURIComponent(a)+"&url="+encodeURIComponent(e),"_blank","noopener,noreferrer");t&&(t.opener=null)},u={height:"1.25em",position:"relative",fontSize:"1.8em",textAlign:"center",border:"0",outline:"0",color:"#fff",background:"transparent",left:"50%",transform:"translate(-50%,0)",marginTop:"1em",marginBottom:"1em",fontFamily:'"Bebas Neue", Arial',verticalAlign:"middle"},p={height:"6.25em",width:"100%",display:"flex"},m=async n=>{n.preventDefault(),t("http://via.placeholder.com/1200x1200"),"http://via.placeholder.com/1200x1200"==e?c().then(n=>{console.log(e),t(n),d(n)}):d(e)};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsxs)(i(),{children:[(0,r.jsx)("title",{children:"Podcast Cover Generator"}),(0,r.jsx)("meta",{name:"description",content:"Generated by create next app"}),(0,r.jsx)("script",{defer:!0,"data-domain":"cover.filmclub-podcast.de",src:"https://analytics.huppenbauer.net/js/script.js"})]}),(0,r.jsx)("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh"},children:(0,r.jsxs)("form",{style:{height:"18.75em",width:"30em",background:"#fff",position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",textTransform:"uppercase",fontFamily:'"Bebas Neue", Arial',color:"#fff"},children:[(0,r.jsx)("h3",{style:{color:"darkgray",textAlign:"center",verticalAlign:"middle",marginTop:"2em",marginBottom:"2em"},children:"Cover Generator"}),(0,r.jsxs)("div",{style:{backgroundColor:"#4daf7c"},children:[" ",(0,r.jsx)("input",{style:u,placeholder:"Filmclub Podcast",value:n,type:"text",onChange:e=>{let{target:t}=e;return l(t.value)}})]}),(0,r.jsxs)("div",{style:{backgroundColor:"#404241",...p},children:[" ",(0,r.jsx)("input",{style:u,placeholder:"0",value:a,type:"number",onChange:e=>{let{target:t}=e;return s(t.value)}})]}),(0,r.jsxs)("div",{style:{backgroundColor:"#e9c85d",...p},children:[" ",(0,r.jsx)("input",{style:u,placeholder:"Bild url (optional)",value:e,type:"url",onChange:e=>{let{target:n}=e;return t(n.value)}})]}),(0,r.jsx)("div",{style:{backgroundColor:"#A30000",...p},children:(0,r.jsx)("span",{style:{display:"inline-block",marginLeft:"3.3em",marginTop:"1em",marginBottom:"1em",height:"1.25em",width:"9em",fontSize:"2em",textAlign:"center",border:"0",outline:"0",verticalAlign:"middle",cursor:"pointer"},onClick:m,children:"Generieren"})})]})})]})}},9008:function(e,t,n){e.exports=n(3121)}},function(e){e.O(0,[774,888,179],function(){return e(e.s=8312)}),_N_E=e.O()}]);