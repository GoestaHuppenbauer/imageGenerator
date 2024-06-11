import { ImageResponse } from '@vercel/og';
import Link from 'next/link';
import { NextRequest } from 'next/server';
import react, { CSSProperties, useState } from "react";

export const config = {
  runtime: 'edge',
};
// ...Vercel Edge functions config object

// Make sure the font exists in the specified path:
const font = fetch(new URL('../../assets/Anton-Regular.ttf', import.meta.url)).then(
  (res) => res.arrayBuffer(),
);
  
const urlHostname = url => {
  try {
    return new URL(url).hostname;
  }
  catch(e) { return e; }
};
  
  // ...exported function
  export default async function (req: NextRequest) {
    const fontData = await font;
 
    try {
     
      // 1: get the searchParams from the request URL
      const { searchParams } = new URL(req.url)
  
      // 2: Check if title or description are in the params
      const hasTitle = searchParams.has('title')
      const hasNumber = searchParams.has('number')
      const hasUrl = searchParams.has('url')
      const hasFit = searchParams.has('fit')
      const hasPosition = searchParams.has('position')
      const hasOrientation = searchParams.has('orientation')
      const hasTarget = searchParams.has('target')
  
      // 3: If so, take the passed value. If not, assign a default
      const title = hasTitle
        ? searchParams.get('title')
        : 'Some title'
        const target = hasTarget
        ? searchParams.get('target')
        : 'post'

      const position = hasPosition?
        searchParams.get('position')
        : 'left'
      const orientation = hasOrientation?
        searchParams.get('orientation')
        : 'hochkant'

        const positionStyle = position === 'left'? {
          left:0
        }
        : position === 'right'? {
          right:0
        }
        : position === 'top'? {
          top:0,
         
        }:  {
          bottom:0,
          
        } as React.CSSProperties;
       
      
        const imageContentStyle = {
            objectFit: hasFit
            ? searchParams.get('fit')
            :  'cover',
          } as React.CSSProperties;
        
        const image = hasUrl
        ? searchParams.get('url')
        :  'http://via.placeholder.com/1200x1200'; 
          

 
      const styles = {
        
        postContainerStyle:{},
        postImageStyle:{},
        storyContainerStyle:{},
        storyImageStyle:{},
      } as React.CSSProperties;



      const imageSizingStyle = (orientation === 'hochkant')?
        {
          width: '1400',
        
        }
      
      :
        { 
         
          height: '1400',
        
      }as React.CSSProperties;

        
      const number = hasNumber
        ? searchParams.get('number')
        : '00'

 
  return new ImageResponse(
    
    (
    <div
        style={{
          backgroundColor:'#1F1F1F',
          width: '100%',
          height: '100%',
          display:'flex',
          textAlign: 'center',
          // alignItems: 'flex-end',
          //justifyContent: 'flex-start',
          position: 'relative',
          objectFit: 'cover',
        }}
    >
        
        <img
        id='image'
          alt="d"
          
          src={`${image}`}
           style={{
            filter: 'brightness(50%) grayscale(100%)',
            position: 'absolute',
            display:'flex',
            
            // width:'1200',
            height:target==='post'?'1400':'1920',
           ...imageSizingStyle,
            ...positionStyle,
            ...imageContentStyle
          }}
        />

        <div
            style={{
                top:'0',
                left:'50px',
                display: 'flex',
                flexDirection: 'column',
                position:'absolute',
            }}
            >
            <h1
                    style={{
                    fontSize: 152,
                    fontFamily: 'Anton',
                    color: '#E3C368',
                    marginBottom: 0,
                    fontWeight: 900,
                    }}
                >
                    {title}
            </h1>
            
        </div>

        <div
          style={{
            marginTop:'auto',
            marginBottom:'auto',
            position: 'absolute',
            display:'flex',
            verticalAlign:'middle',
            justifyContent: 'center',
           bottom:'80px',
           right:'-240px',
            transform: 'rotate(-45deg)',
			backgroundColor: '#E3C368',
            width:'800px',
            height:'120px',
          }}
        >
        <p
            style={{
            
                
              fontFamily: 'Anton',
              fontSize: 60,
              color: '#1F1F1F',
              fontWeight: 700,
              
            }}
          >
           {number}
        </p>
        </div>
        <div style={{
          bottom:'10px',
          left:'10px',
          display:'flex',
          position: 'absolute',
        }}>
          <p style={{
            color:'#F0F0F0',
            
          }}>Quelle: {urlHostname(image)}</p>
          
        </div>
    </div>
  
      
    ),
    {
      width: target=== 'post'?1400:1080,
      height: target=== 'post'?1400:1920,
      fonts: [
        {
          name: 'Anton',
          data: fontData,
          style: 'normal',
        },
      ],
    }
    ) 
   
  } catch (e) {
    return new Response(`Failed to generate the image`, {
      status: 500,
    })
  }
}