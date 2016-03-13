# CCSSS - Critical-path CSS Service

_Work in progress..._


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

At [Hopwork](https://www.hopwork.fr), we ran a custom solution that reused our Selenium
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

_Let's code the tool first..._
