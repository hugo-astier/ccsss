# CCSSS - Critical-path CSS Service

## What

Yet another critical-path CSS tool. Don't know what it's for? Please refer to
[this article](https://developers.google.com/web/fundamentals/performance/critical-rendering-path/?hl=en).

In brief:

* it's an API
* that will extract the critical-path CSS of your Web pages
* and return it to your website
* so that generation and inclusion of that CSS is automated.


## Why another tool

Some existing solutions such as Addy Osmani's [critical](https://github.com/addyosmani/critical)
will require you to have a static version of your pages to run the tool during your build.  
For dynamic websites, this won't do, obviously.

At [Hopwork](https://www.hopwork.com), we ran a custom solution that reused our Selenium
test harness to dump the HTML code of our pages for `critical` to work on it, but it was
still quite unpractical, especially since the page look depends on a lot of data that
have to be reproduced for those test runs.

Other solutions such as [criticalcss.com](http://criticalcss.com/) will let you enter
your Web page addresses and return you the critical-path CSS, but it can't be automated,
which make it a no-go.

Finally, [Google PageSpeed module](https://developers.google.com/speed/pagespeed/module/filter-prioritize-critical-css)
for Apache and Nginx is able to generate and inline critical-path CSS when proxying
requests, but it has a number of limitations (doesn't work for IE, handle all requests
whether the user agent already had the opportunity to cache regular CSS files or not, etc.)

So, this tool relies on [penthouse](https://github.com/pocketjoso/penthouse), as the
other tools quoted, but it provides a way to get the critical-path CSS that corresponds
to your Web page, while allowing for automating the generation and inclusion of that CSS
into the website. Of course, it can't be part of your build as it will hit the real
website, but it can be part of your post-deployment tasks, though.


## Documentation

Start ccsss:

    $ ccsss --port 1234


The port may be omitted, ccsss will run on port 8888 by default.

Post a critical-path CSS generation request:

    $ curl -v -H "Content-Type: application/json" -X POST -d '{
        "url": "http://mywebsite.org/some/page",
        "dimensions": [{
            "width": 1280,
            "height": 800
        }, {
            "width": 320,
            "height": 568
        }],
        "notificationUrl": "http://mywebsite.org/notification/critical-css-ready"
    }' http://localhost:8888/generation/request

ccsss will return you something like the following:

      ...
    < HTTP/1.1 202 Accepted
    < Location: http://localhost:8888/generation/result/47edab4c-caa7-4dc9-987a-f04716ed009f
      ...

    {"generationId":"1103f981-8052-4d3a-b098-d8f6c3eede22","status":"pending"}

The `Location` header tells you where the result will be available once the generation is over.
The JSON response also gives you a generation ID so you can later on associate notifications with
the requests you made.

Assuming you do have a endpoint at http://mywebsite.org/notification/critical-css-ready,
you will receive a notification like the following one once the result is available:

    {
        "generationId": "1103f981-8052-4d3a-b098-d8f6c3eede22",
        "status": "success",
        "resultLocation": "http://localhost:8888/generation/result/47edab4c-caa7-4dc9-987a-f04716ed009f"
    }

You can then get you result. Note that having a `notificationUrl` is optional and that
you can also blindly poll the given result URL from the beginning.

    $ curl -v http://localhost:8888/generation/result/47edab4c-caa7-4dc9-987a-f04716ed009f
      ... 
    < HTTP/1.1 200 OK
    < Content-Type: text/css
      ...

    #myElement,.my-class{position:relative}code,h1,h2,h3{word-wrap:break-word} /* ... */

Finally, please note that once a result has been consumed, it is forgotten by the server:

    $ curl -v http://localhost:8888/generation/result/47edab4c-caa7-4dc9-987a-f04716ed009f
      ... 
    < HTTP/1.1 404 Not Found
      ...
    Not found
