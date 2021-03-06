const express = require('express')
const axios = require("axios")

const cheerio = require('cheerio')
const path = require('path');
var bodyParser = require('body-parser');
const { check } = require('express-validator');
const helmet = require("helmet");
const cacheControl = require("express-cache-controller")
const app = express();
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);





app.use(bodyParser.urlencoded());
app.use(bodyParser.json());

app.use(express.json())



// Web scrapping functions
app.set("views", path.join(__dirname,'views'));
app.set('view engine', 'ejs')
app.use(express.static(path.join(__dirname, 'public')))

/***
 * Functions to get data
 */

// Amazon
const getFromAmazon =async (queryItem="",pageNo=1,sortBy="") => {
  try{
    var items = []
    var typeSortBy
    if(!sortBy.localeCompare("new")) {
      typeSortBy = "date-desc-rank"
    } else if (!sortBy.localeCompare("plh")) {
      typeSortBy = "price-asc-rank"
    }  else if (!sortBy.localeCompare("phl")) {
      typeSortBy = "price-desc-rank"
    } else {
      typeSortBy=""
    }
    
    const result= await axios.get(`https://www.amazon.com/s?k=${queryItem}&s=${typeSortBy}&page=${pageNo}`,{
      headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.90 Safari/537.36'
      }
  })
    const $ = await cheerio.load(result.data);
    

    $('.s-result-item').each(function(){ 
      var item = {
        image :$(this).find("img").attr("src"),
        link: `https://www.amazon.com${$(this).find("a").attr("href")}`,
        title:$(this).find("h2").text(),
        price:$(this).find('.a-price').text() === "" ? "Price not available" : `$${$(this).find('.a-price').text().trim().split('$')[1]}`,
        coupon:$(this).find('.s-coupon-clipped.aok-hidden').text(),
        rating:$(this).find('.a-icon-alt').text() === "" ? "Rating: Not available" :`Rating: ${$(this).find('.a-icon-alt').text()}`,
        description:$(this).find('.a-color-price').text() 
        // reviews:$(this).find('.a-link-normal').find(".a-size-base").text()        
      }      
       items.push(item)
      
    })
    items.shift()
    return items
  } catch(err) {
    return []
  }
}

//function to get from E-bay\
const getFromEbay =async (queryItem="",pageNo=1,sortBy="") => {
  try{
    let items = []
    var typeSortBy
    if(!sortBy.localeCompare("new")) {
      typeSortBy = 10
    } else if (!sortBy.localeCompare("plh")) {
      typeSortBy = 15
    }  else if (!sortBy.localeCompare("phl")) {
      typeSortBy = 16
    } else {
      typeSortBy=""
    }
    const result= await axios.get(`https://www.ebay.com/sch/i.html?_nkw=${queryItem}&_sop=${typeSortBy}&_pgn=${pageNo}`,{
      headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.90 Safari/537.36'
      }
  })    
    const $ = cheerio.load(result.data);
    

    $('.s-item.s-item--watch-at-corner').each(function(){ 
      var item = {
        image :$(this).find('.s-item__image-img').attr("src"),
        link: $(this).find("a").attr("href"),
        title:$(this).find(".s-item__title").text(),
        price:`$${$(this).find(".s-item__price").text().trim().split('$')[1]}`,
        discount:$(this).find(".s-item__discount.s-item__discount").text(),
        shippingFrom:$(this).find(".s-item__location.s-item__itemLocation").text(),    
        shippingCost:$(this).find(".s-item__shipping.s-item__logisticsCost").text(),    
        description:$(this).find('.s-item__gsp-info.s-item__gspInfo').text(),
        hotness:$(this).find('.a-link-normal').find(".s-item__hotness.s-item__itemHotness").text()        
      }      
       items.push(item)
    })
    
    return items
  } catch(err) {
    return []
  }
}


app.use(cacheControl({
  noCache: true
}));
/**
 * API requests
 */
// Get request

app.get('/',(req,res)=>{
  res.render("index")
})
app.get('/error',(req,res)=>{
  res.render("error")
})
app.get('/products',async(req, res) => {
  let queryItem
  let pageNo
  let sortBy
  // console.log("started")
  queryItem = req.query.queryItem ?`${req.query.queryItem}`:""
  pageNo = req.query.pageNo ?`${req.query.pageNo}`:1
  sortBy = req.query.sortBy ?`${req.query.sortBy}`:""

  // console.log(queryItem,pageNo,sortBy)
  
  try {
    var amazon =await getFromAmazon(queryItem,pageNo,sortBy)  
    var ebay =await getFromEbay(queryItem,pageNo,sortBy)  

    if(amazon.length ===0 ) {
      for (i = 0; i < 5; i++) {
      
        amazon =await getFromAmazon(queryItem,pageNo,sortBy)  
        
        if( amazon.length > 0) {
          break
        }
      }
    }
    // rendering
    // res.render("index")
    res.render("products",{
      "queryItem":queryItem,
      "pageNo":pageNo,
      "sortBy":sortBy,
      "amazon":amazon,
      "ebay":ebay
    })  
  } catch (err) {
    res.redirect("/error")
  }
  
    
  
  // console.log("done")
  
})

// Post request
app.post('/', [
  check('search').isLength({ min: 1 }).trim().escape(),
  
],  async (req, res) => {
  var queryItem
  if(req.body.search) {
    queryItem = req.body.search
  } else {
    queryItem = ""
  }
  try {
     
    var ebay =await getFromEbay(queryItem)  
    var amazon =await getFromAmazon(queryItem) 
    // console.log(amazon)
    if(amazon.length ===0 ) {
      for (i = 0; i < 5; i++) {
        amazon =await getFromAmazon(queryItem) 
        if( amazon.length > 0) {
          break
        }
      }
    }


    res.render("products",{
      "queryItem":queryItem,
      "pageNo":1,
      "sortBy":"",
      "amazon":amazon,
      "ebay":ebay
    })  
  } catch (err) {
    res.redirect("/error")
  }
})


// ///////////////////
app.listen(process.env.PORT || 5000);