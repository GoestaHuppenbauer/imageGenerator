import { CSSProperties, useState } from "react";
import axios from "axios";
import Link from "next/link";
import Head from "next/head";



export default function Home() {


  





  const [url,setUrl]  = useState('http://via.placeholder.com/1200x1200');
  const [title,setTitle]  = useState('Filmclub Podcast');
  const [number,setNumber]  = useState('00');
  const [fit,setFit]  = useState('cover');
  const [position,setPosition]  = useState('left');
  const [orientation,setOrientation]  = useState('hochkant');
  const [target,setTarget]  = useState('post');
  const fetchImage = async () => {
    const FetchUrl = 'https://api.themoviedb.org/3/search/movie?api_key=15d2ea6d0dc1d476efbca3eba2b9bbfb&query=' + encodeURIComponent(title)
    
    const response = await fetch(FetchUrl);
    

    const d = await response.json();
    if(d.total_results!=0){
      //const id= Math.floor(Math.random() * d.total_results) + 0
      //console.log(id + ' / ' + d.total_results)
      const link = d.results[0].backdrop_path;

      console.log('image'+JSON.stringify(d.results))
    return 'https://image.tmdb.org/t/p/original'+link
    }
    else{
      return 'http://via.placeholder.com/1200x1200'
    }
    
}

  const openInNewTab = (l) => {
    const newWindow = window.open('/api/og?title='+encodeURIComponent(title)+'&number='+encodeURIComponent(number)+'&fit=' + encodeURIComponent(fit)+'&position=' + encodeURIComponent(position)+'&orientation=' + encodeURIComponent(orientation)+'&target=' + encodeURIComponent(target)+'&url='+encodeURIComponent(l), '_blank', 'noopener,noreferrer')
    if (newWindow) newWindow.opener = null
  }
  const inputStyle:CSSProperties = {
    height: '1.25em',
    position:'relative', 
    fontSize: '1.8em',
    textAlign:'center',
    border: '0',
    outline: '0',
    color: '#fff',
    background: 'transparent',
    left:'50%',
    transform: 'translate(-50%,0)',
    marginTop: '1em',
    marginBottom: '1em',
    fontFamily: '"Bebas Neue", Arial',
    verticalAlign: 'middle',
  } 
  const divStyle = {
    height: '6.25em',
    width: '100%',
    display: 'flex',}
  const handleGenerate =  async (event) => {
    event.preventDefault(); 
    setUrl('http://via.placeholder.com/1200x1200')
    if(url=='http://via.placeholder.com/1200x1200'){
      fetchImage().then((d) => { 
        
         setUrl(d);openInNewTab(d); })
  
    }
    else{
      openInNewTab(url)
    }
    
   
}
  return (
    <>
    <Head>
      <title>Podcast Cover Generator</title>
      <meta name="description" content="Generate Podcast Covers and Instagram Posts" />
      <script defer data-domain="https://cover.filmclub-podcast.de" src="https://analytics.huppenbauer.net/js/script.js"></script>
    </Head>
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh'}}>
    
      <form style={{
        height: '20.75em',
        width: '30em',
        background: '#fff',
        position: 'absolute',
        top: '25%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        textTransform: 'uppercase',
        fontFamily: '"Bebas Neue", Arial',
        color: '#fff',
      }}>
      <h3 style={{color:'darkgray',textAlign:'center',verticalAlign:'middle',marginTop:'2em',marginBottom:'2em'}} >Cover Generator</h3>
     <div  style={{backgroundColor:'#4daf7c',}}> <input style={inputStyle} placeholder="Filmclub Podcast" value={title} type="text" onChange={({target}) => setTitle(target.value)}></input></div>
     <div  style={{backgroundColor:'#404241',...divStyle}}> <input style={inputStyle} placeholder="0" value={number} type="text" onChange={({target}) => setNumber(target.value)}></input></div>
     <div  style={{backgroundColor:'#e9c85d',...divStyle}}> <input style={inputStyle}placeholder="Bild url (optional)" value={url} type="url" onChange={({target}) => setUrl(target.value)}></input></div>
     <div  style={{backgroundColor:'darkgray',...divStyle}}>
      <select onChange={({target}) => setFit(target.value)} name="fit" id="fit" form="imageStyle" style={{backgroundColor:'#4daf7c',width:'100%', textAlign:'center', fontSize: '1.8em', fontFamily: '"Bebas Neue", Arial',border: '0',
    outline: '0',
    color: '#fff',}}>
        <option value="cover">Cover</option>
        <option value="contain">Contain</option>
        <option value="fill">Fill</option>
        <option value="none">None</option>
</select></div>
<div  style={{backgroundColor:'darkgray',...divStyle}}>
      <select onChange={({target}) => setPosition(target.value)} name="Position" id="position" form="imageStyle" style={{backgroundColor:'#404241',width:'100%', textAlign:'center', fontSize: '1.8em', fontFamily: '"Bebas Neue", Arial',border: '0',
    outline: '0',
    color: '#fff',}}>
        <option value="left">Left</option>
        <option value="right">Right</option>
        <option value="bottom">Bottom</option>
        <option value="top">Top</option>
</select></div>

<div  style={{backgroundColor:'darkgray',...divStyle}}>
      <select onChange={({target}) => setOrientation(target.value)} name="Ausrichtung" id="position" form="imageStyle" style={{backgroundColor:'#4daf7c',width:'100%', textAlign:'center', fontSize: '1.8em', fontFamily: '"Bebas Neue", Arial',border: '0',
    outline: '0',
    color: '#fff',}}>
        <option value="left">Hochkant</option>
        <option value="right">Quer</option>
       
</select></div>
<div  style={{backgroundColor:'darkgray',...divStyle}}>
      <select onChange={({target}) => setTarget(target.value)} name="Target" id="target" form="imageStyle" style={{backgroundColor:'#e9c85d',width:'100%', textAlign:'center', fontSize: '1.8em', fontFamily: '"Bebas Neue", Arial',border: '0',
    outline: '0',
    color: '#fff',}}>
        <option value="post">Post</option>
        <option value="story">Story</option>
       
</select></div>
     <div style={{backgroundColor:'#A30000',...divStyle}}><span
  style={{
    display:'inline-block',
    marginLeft: '3.3em',
    marginTop: '1em',
    marginBottom: '1em',
    
    height: '1.25em',
    width: '9em',
    fontSize: '2em',
    textAlign:'center',
    border: '0',
    outline: '0',
    verticalAlign: 'middle',
    cursor: 'pointer',
  }} onClick={handleGenerate }>Generieren</span>
</div>
      
      </form>
   </div>
    </>
  )
}
