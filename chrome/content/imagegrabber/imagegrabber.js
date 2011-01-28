/****************************** Start of GPL Block ****************************
 *   ImageHost Grabber - Imagegrabber is a firefox extension designed to 
 *   download pictures from image hosts such as imagevenue, imagebeaver, and 
 *   others (see help file for a full list of supported hosts).
 *
 *   Copyright (C) 2007   Matthew McMullen.
 * 
 *   This program is free software; you can redistribute it and/or modify
 *   it under the terms of the GNU General Public License as published by
 *   the Free Software Foundation; either version 2 of the License, or
 *   (at your option) any later version.
 *
 *   This program is distributed in the hope that it will be useful,
 *   but WITHOUT ANY WARRANTY; without even the implied warranty of
 *   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *   GNU General Public License for more details.
 *
 *   You should have received a copy of the GNU General Public License
 *   along with this program; if not, write to the Free Software
 *   Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
 *
 ***************************  End of GPL Block *******************************/




/* function hostGrabber:
 *
 * Takes one parameter: 
 * docLinks:		a multi-dimensional array of strings where the first dimension
 *				represents the first page and the second dimension represents
 *				all the links for that page
 *
 * If docLinks is null (such is the case if you don't use the thread sucker), then the
 * function will create a docLinks and fill it with the links on the current page.  Also,
 * it will be assumed that suckMode is false if docLinks is null.
 *
 * Returns nothing.
 *
 */
ihg_Functions.hostGrabber = function hostGrabber(docLinks, filterImages) {
	ihg_Functions.LOG("Entering function hostGrabber.\n");
	if(!docLinks) {
		ihg_Globals.strbundle = document.getElementById("imagegrabber-strings");
		ihg_Functions.read_locale_strings();
	
		ihg_Globals.suckMode = false;

		// Initialize variables if not already initialized
		var feelItRex = ihg_Functions.initVars();
		if (!feelItRex) {
			ihg_Functions.LOG("In hostGrabber, call to function initVars failed for some reason.\n");
			return;
			}

		var docLinks = new Array();
		var thumbLinks = new Array();
		
		docLinks[ihg_Globals.firstPage] = new Array();
		thumbLinks[ihg_Globals.firstPage] = new Array();
		
		for (var q = 0; q < content.document.links.length; q++) {
			var someNode = content.document.links[q];
			docLinks[ihg_Globals.firstPage][q] = someNode.href;
			thumbLinks[ihg_Globals.firstPage][q] = null;
			for (var a = 0; a < someNode.childNodes.length; a++) {
 				var someTagName = someNode.childNodes[a].tagName;
  				if (someTagName) {
 					if (someTagName.search(/img/i) >= 0) {
 						thumbLinks[ihg_Globals.firstPage][q] = {
							src:someNode.childNodes[a].src,
							width:someNode.childNodes[a].naturalWidth,
 							height:someNode.childNodes[a].naturalHeight
							}
 						break;
 						}
 					}
  				}
			}
			
 		if (ihg_Globals.downloadEmbeddedImages) {
			var imgs = content.document.images;
			for (var q = 0; q < imgs.length; q++) {
				if (imgs[q].naturalHeight >= ihg_Globals.minEmbeddedHeight && imgs[q].naturalWidth >= ihg_Globals.minEmbeddedWidth) {
					// add a tag to the link so we can identify it later
					docLinks[ihg_Globals.firstPage].push("[embeddedImg]" + imgs[q].src);
					thumbLinks[ihg_Globals.firstPage].push({ src:imgs[q].src, width:imgs[q].naturalWidth, height:imgs[q].naturalHeight });
					}
 				}
 			}	
		}
	ihg_Functions.LOG("In hostGrabber, docLinks is equal to: " + docLinks.toSource() + "\n");

	if (ihg_Globals.lastHost.urlPattern) {
		ihg_Globals.lastHost = { hostID : null, maxThreads : null, urlPattern : null, searchPattern : null };
		}

	if (ihg_Globals.hosts_list) ihg_Globals.hosts_list = null;
	if (ihg_Globals.unknownHosts_list) ihg_Globals.unknownHosts_list = new Array();
	
	var time = new Date();
	var x = time.getTime();

	if (ihg_Globals.suckMode) var objLinks = ihg_Functions.setUpLinksOBJ(docLinks, filterImages);
	else var objLinks = ihg_Functions.setUpLinksOBJ(docLinks, filterImages, thumbLinks);

	var tmp_req_objs = ihg_Functions.setUpReq(objLinks);
	tmp_req_objs = ihg_Functions.setUpLinkedList(tmp_req_objs);

	var time = new Date();
	var y = time.getTime();

	// Uncomment this line to get benchmark results
	//alert((y-x)/1000);

	var ig_dl_win_obj = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher);
	ig_dl_win = ig_dl_win_obj.getWindowByName("ig-dl_win", null);
	if (!ig_dl_win) {
		ig_dl_win = ig_dl_win_obj.openWindow(null, "chrome://imagegrabber/content/interfaces/downloads.xul", "ig-dl_win", "resizable,scrollbars=yes", null);
		ig_dl_win.req_objs = tmp_req_objs;

		ig_dl_win.onload = ihg_Functions.finishUp;
		}
	else {
		if (ig_dl_win.req_objs) {
			var new_array = Array.concat(ig_dl_win.req_objs, tmp_req_objs);
			for(var i=0; i < new_array.length; i++)	new_array[new_array[i].uniqID] = new_array[i];
			delete ig_dl_win.req_objs;
			new_array = ihg_Functions.setUpLinkedList(new_array);
			ig_dl_win.req_objs = new_array;
			}
		else ig_dl_win.req_objs = tmp_req_objs;

		var doc = ig_dl_win.document;
		var supPop = doc.getElementById("cbSupPop").checked;

		if (!supPop) ig_dl_win.focus();
		ihg_Functions.finishUp(tmp_req_objs);
		}
	} //end of hostGrabber function


ihg_Functions.finishUp = function finishUp(req_objs) {
	// if this is the event for the window load, re-assign the variable
	// pick something from the event class to identify it as an event
	// the member "type" is sufficient
	if (req_objs.type) req_objs = this.req_objs;

	ihg_Functions.updateDownloadStatus(ihg_Globals.strings.running);

	for(var i = 0; i < req_objs.length; i++) {
		var m = req_objs[i].curLinkNum + 1;
		var page_stat = ihg_Globals.strings.page + " " + req_objs[i].pageNum + ": " + m + " " + ihg_Globals.strings.of + " " + req_objs[i].totLinkNum;
		ihg_Functions.addDownloadProgress(page_stat, req_objs[i].uniqID, req_objs[i].reqURL, ihg_Globals.strings.waiting);
		}


	// This means it found no links
	if (req_objs.length == 0) return;
	
	ihg_Functions.setFocus();
	
	req_objs[0].queueHandler();
	}



ihg_Functions.showDLWin = function showDLWin(fileName) {
	ihg_Globals.strbundle = document.getElementById("imagegrabber-strings");
	ihg_Functions.read_locale_strings();
	
	ihg_Functions.initVars(true); // true to suppress directory selection dialog

	var req_objs = ihg_Functions.getDLCache(fileName);
	//if (!req_objs) return;

	var ig_dl_win_obj = Components.classes["@mozilla.org/embedcomp/window-watcher;1"].getService(Components.interfaces.nsIWindowWatcher);
	ig_dl_win = ig_dl_win_obj.getWindowByName("ig-dl_win", null);
	if (!ig_dl_win) {
		ig_dl_win = ig_dl_win_obj.openWindow(null, "chrome://imagegrabber/content/interfaces/downloads.xul", "ig-dl_win", "resizable,scrollbars=yes", null);
		
		if (req_objs) {
			ig_dl_win.req_objs = req_objs;

			ig_dl_win.onload = function () {
				for(var i = 0; i < req_objs.length; i++) {
					var m = req_objs[i].curLinkNum + 1;
					var page_stat = ihg_Globals.strings.page + " " + req_objs[i].pageNum + ": " + m + " " + ihg_Globals.strings.of + " " + req_objs[i].totLinkNum;
					ihg_Functions.addDownloadProgress(page_stat, req_objs[i].uniqID, req_objs[i].reqURL, req_objs[i].status);
					ihg_Functions.updateDownloadProgress(null, req_objs[i].uniqID, null, (req_objs[i].curProgress / req_objs[i].maxProgress) * 100, null);
				}

				ihg_Functions.setFocus();
			};
		}
	}
	else {
		ig_dl_win.focus();
		return;
	}
}


ihg_Functions.getDLCache = function getDLCache(fileName) {
	var target;
	if (ihg_Globals.lastSessionDir) {
		var cacheDir = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
		cacheDir.initWithPath(ihg_Globals.lastSessionDir);
	}
	else {
		var cacheDir =  Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsIFile);
		
		cacheDir.append("ihg_cache");
		if (!cacheDir.exists() || !cacheDir.isDirectory()) { 
			cacheDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0755);  
			}
		
		if (fileName) {
			cacheDir.append(fileName);
			target = cacheDir.target;
		}
	}
	
	if (!fileName) {
		var nsIFilePicker = Components.interfaces.nsIFilePicker;
		var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
		fp.init(window, null, nsIFilePicker.modeOpen);
		fp.displayDirectory = cacheDir;
			
		var rv = fp.show();
		if (rv == nsIFilePicker.returnCancel) return null;
		target = fp.file.path;
	}
	
	var dlCache = new ihg_Functions.dlWinCacheService(target);
	var cacheDoc = dlCache.getCache();
	if (!cacheDoc) return null;

	var reqList = cacheDoc.getElementsByTagName("reqObj");
	var req_objs = new Array();
	for (var h = 0; h < reqList.length; h++) {
		req_objs[h] = new ihg_Functions.requestObj();
		var props = reqList[h].getElementsByTagName("prop");
		for (var i = 0; i < props.length; i++) { 
			var propType = props[i].getAttribute("type");

			var propName = props[i].getAttribute("id");
			propName = propName.match(/(.+)_\d+/)[1];

			if (propType == "function") {
				var tempThing = props[i].textContent;
				var cunt = tempThing.match(/function anonymous\((.+),(.+)\)/);
				
				var aa = tempThing.replace(/[\n\f\r]/g, 'NEWLINE');
				var bb = aa.match(/{(.+)}/)[1];
				var cc = bb.replace(/NEWLINE/g, '\n');
				
				propValue = new Function(cunt[1], cunt[2], cc);
				}
			else if (propType == "string") var propValue = props[i].textContent;
			else if (propType == "number") var propValue = parseInt(props[i].textContent);
			else if (propType == "boolean") {
				if (props[i].textContent == "true") var propValue = true;
				else var propValue = false;
				}

			req_objs[h][propName] = propValue;
			req_objs[h].hostFunc = ihg_Functions.genericHostFunc;
			req_objs[h].debugLog();
			}
		req_objs[h].inprogress = false;
		req_objs[req_objs[h].uniqID] = req_objs[h];
		}

	req_objs = ihg_Functions.setUpLinkedList(req_objs);
	return req_objs;
	}



/* function setUpLinksOBJ:
 *
 * Takes one parameter:
 * docLinks:		a multi-dimensional array of strings where the first dimension
 *				represents the first page and the second dimension represents
 *				all the links for that page
 *
 * Returns an object of the LinksOBJ class.
 *
 */
ihg_Functions.setUpLinksOBJ = function setUpLinksOBJ(docLinks, filterImages, thumbLinks) {
	var objLinks = new ihg_Functions.LinksOBJ();
	var dateString = ihg_Functions.getFormattedDate();

	// Need to send thumbLinks to removeDuplicates to keep the 
	// indices between docLinks and thumbLinks the same
	if (ihg_Globals.remove_duplicate_links) {
		var temp = ihg_Functions.removeDuplicates(docLinks, thumbLinks);
		docLinks = temp.docLinks;
		thumbLinks = temp.thumbLinks;
		}

	for (var i = ihg_Globals.firstPage; i <= ihg_Globals.lastPage; i++) {
		var t_count = 0;

		objLinks.links[i] = new Array();
		objLinks.thumbs[i] = new Array();
		objLinks.dirSave[i] = new Array();
		objLinks.hostFunc[i] = new Array();
		objLinks.hostID[i] = new Array();
		objLinks.maxThreads[i] = new Array();
		
		// Added to give a proper referring url for embedded images
		objLinks.originatingPage[i] = new Array();

		for (var j = 0; j < (ihg_Globals.suckMode?docLinks[i].length-1:docLinks[i].length); j++) {
			// check to see if link has an embedded image tag
			var isEmbedded = docLinks[i][j].match(/\[embeddedImg\](.+)/);
			
			// gets rid of the anonymizers
			var tmpMatch = unescape(docLinks[i][j]).match(/https?:\/\/.+(https?:\/\/.+)/);
			if(tmpMatch) docLinks[i][j] = tmpMatch[1];
			
			if (isEmbedded) var theHostToUse = { hostID : "Embedded Image" , maxThreads : 0, hostFunc : "Embedded Image" };
			else var theHostToUse = ihg_Functions.getHostToUse(docLinks[i][j]);
			
			if (theHostToUse) {
				if (ihg_Globals.suckMode) {
					// The originating page is added to the end of docLinks array if
					// IHG is run in thread sucker mode.
					objLinks.originatingPage[i][t_count] = docLinks[i][docLinks[i].length-1];
					objLinks.thumbs[i][t_count] = null;
					}
				else {
					objLinks.originatingPage[i][t_count] = content.document.location.href;
					objLinks.thumbs[i][t_count] = thumbLinks[i][j];
					}
				objLinks.hostFunc[i][t_count] = theHostToUse.hostFunc;
				objLinks.links[i][t_count] = isEmbedded?isEmbedded[1]:docLinks[i][j];
				objLinks.hostID[i][t_count] = theHostToUse.hostID;
				objLinks.maxThreads[i][t_count] = theHostToUse.maxThreads;
				
				// Create an instance of the local file object
				var aFile = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
				aFile.initWithPath(ihg_Globals.baseDirSave);

				// Create a directory for the doc title if option is set
				if (ihg_Globals.createDocTitSF) aFile.append((ihg_Globals.prefix_directories?(dateString + "_"):"") + ihg_Globals.docTitle);

				// Create a directory for each page if in suck mode
				if (ihg_Globals.suckMode) {
					if (ihg_Globals.createPageDirs) aFile.append(ihg_Globals.strings.page + i);
					}

				var doesDirExist = aFile.exists();
				if (!doesDirExist) aFile.create(1,0755); // 1 for directory, 0 for file
				objLinks.dirSave[i][t_count] = aFile.path;

				t_count++;
				} //end of if statement

			} // end of inner-for loop

		} // end of outer-for loop

	if (filterImages) {
		var filtered = ihg_Functions.showFilterDialog(objLinks);
		if (!filtered) return;
	
		objLinks = filtered.links;
		}
	
	return objLinks;
	} //end of function




/* function setUpReq:
 *
 * Takes one parameter:
 * objLinks:	An object of the LinkOBJ class.  
 *
 * Returns an array of request objects. 
 *
 */
ihg_Functions.setUpReq = function setUpReq(objLinks) {
	var temp_array = new Array();
	var count = 0;

	for(var i = ihg_Globals.firstPage; i <= ihg_Globals.lastPage; i++) {
		var fName = ihg_Functions.getFormattedDate();

		for(var j = 0; j < objLinks.links[i].length; j++) {
			var inner_link = objLinks.links[i][j];
			var dir_save = objLinks.dirSave[i][j];
			var host_ID = objLinks.hostID[i][j];
			var host_maxThreads = objLinks.maxThreads[i][j];
			var host_func = objLinks.hostFunc[i][j];
			
			var req = new ihg_Functions.requestObj();
			
			req.hostID = host_ID;
			req.maxThreads = host_maxThreads;
			req.regexp = host_func;
			req.hostFunc = ihg_Functions.genericHostFunc;
				
			req.reqURL = inner_link;
			req.originatingPage = objLinks.originatingPage[i][j];
			req.dirSave = dir_save;
			req.retryNum = ihg_Globals.maxRetries;
			req.pageNum = i;
			req.curLinkNum = j;
			req.totLinkNum = objLinks.links[i].length;
			req.uniqID = "req_" + Math.round(Math.random() * 1e9);
			req.uniqFN_prefix = fName;
			req.minFileSize = ihg_Globals.minFileSize;

			//if (inner_link.match(/boxtheclown/)) req.init = boxclown_init;

			req.debugLog();

			temp_array[count] = req;
			temp_array[req.uniqID] = temp_array[count];
			count++;
			} // end of inner-for loop
		} // end of outer-for loop

	return temp_array;
	} // end of function


/* function setUpLinkedList:
 *
 * Takes one parameter:
 * req_objs:	An array of objects of the requestObj class
 *
 * Returns an array of objects of the requestObj class.
 *
 * The purpose of this function is to set up the linked list
 * for the requestObj class.  In this case, links are refering
 * to other objects and not to html links.
 *
 */
ihg_Functions.setUpLinkedList = function setUpLinkedList(req_objs) {
	var lastObj = req_objs.length - 1;

	for(var i = 0; i < req_objs.length; i++) {
		if (i == 0) req_objs[i].previousRequest = null;
		else req_objs[i].previousRequest = req_objs[i-1];

		if (i == lastObj) req_objs[i].nextRequest = null;
		else req_objs[i].nextRequest = req_objs[i+1];

		req_objs[i].firstRequest = req_objs[0];
		req_objs[i].lastRequest = req_objs[lastObj];
		
		req_objs[i].index = i;
		}

	return req_objs;
	}
	


/* LinksOBJ class constructor:
 *
 * links:	 	a multi-dimensional array of strings.  The first dimension represents 
 * 			the page number.  The second dimension represents the links belonging 
 *			to that page. 
 *
 * dirSave:		a multi-dimensional array of strings.  The first dimension represents 
 *			the page number.  The second dimension represents the directory where 
 *			the image will be saved.
 *
 * hostFunc:	a multi-dimensional array of functions.  The first dimension represents
 *			the page number.  The second dimension an actual function that will be 
 * 			used to handle the requests.
 *
 */
ihg_Functions.LinksOBJ = function LinksOBJ() {
	this.links = new Array();
	this.dirSave = new Array();
	this.hostFunc = new Array();
	this.thumbs = new Array();
	this.hostID = new Array();
	this.maxThreads = new Array();
	
	// The following is added to give a proper referring url when downloading embedded images
	this.originatingPage = new Array();
	}



////////////////////////  Get imagegrabber preferences  ////////////////////////
ihg_Functions.getIGPrefs = function getIGPrefs() {
	var myself = String(arguments.callee).match(/(function.*)\(.*\)[\n\s]*{/m)[1];
	ihg_Functions.LOG("Entering " + myself + "\n");

	

	ihg_Globals.showDLDir = ihg_Globals.prefManager.getBoolPref("extensions.imagegrabber.showdldir");
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.showDLDir is equal to: " + ihg_Globals.showDLDir + "\n");

	try {
		ihg_Globals.lastDLDir = ihg_Globals.prefManager.getCharPref("extensions.imagegrabber.lastdldir");
		ihg_Globals.lastSessionDir = ihg_Globals.prefManager.getCharPref("extensions.imagegrabber.lastsessiondir");
		}
	catch(err) {
		ihg_Globals.prefManager.setCharPref("extensions.imagegrabber.lastdldir", "");
		ihg_Globals.prefManager.setCharPref("extensions.imagegrabber.lastsessiondir", "");
		}

	ihg_Functions.LOG("In " + myself + ", ihg_Globals.lastDLDir is equal to: " + ihg_Globals.lastDLDir + "\n");

	ihg_Globals.AUTO_RENAME = ihg_Globals.prefManager.getBoolPref("extensions.imagegrabber.autorename");
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.AUTO_RENAME is equal to: " + ihg_Globals.AUTO_RENAME + "\n");

	ihg_Globals.fileExistsBehavior = ihg_Globals.prefManager.getCharPref("extensions.imagegrabber.fileexistsbehavior");
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.fileExistsBehavior is equal to: " + ihg_Globals.fileExistsBehavior + "\n");
	
	ihg_Globals.remove_duplicate_links = ihg_Globals.prefManager.getBoolPref("extensions.imagegrabber.removeduplinks");
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.remove_duplicate_links is equal to: " + ihg_Globals.remove_duplicate_links + "\n");

	ihg_Globals.remove_duplicate_links_across_pages = ihg_Globals.prefManager.getBoolPref("extensions.imagegrabber.removeduplinksXpages");
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.remove_duplicate_links_across_pages is equal to: " + ihg_Globals.remove_duplicate_links_across_pages + "\n");

	ihg_Globals.maxThreads = ihg_Globals.prefManager.getIntPref("extensions.imagegrabber.maxthreads");
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.maxThreads is equal to: " + ihg_Globals.maxThreads + "\n");

	ihg_Globals.maxRetries = ihg_Globals.prefManager.getIntPref("extensions.imagegrabber.numretries");
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.maxRetries is equal to: " + ihg_Globals.maxRetries + "\n");

	ihg_Globals.reqTimeout = ihg_Globals.prefManager.getIntPref("extensions.imagegrabber.requesttimeout");
	ihg_Globals.reqTimeout *= 1000;
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.reqTimeout is equal to: " + ihg_Globals.reqTimeout + "\n");

 	ihg_Globals.downloadEmbeddedImages = ihg_Globals.prefManager.getBoolPref("extensions.imagegrabber.downloadembeddedimages");
 	ihg_Functions.LOG("In " + myself + ", ihg_Globals.downloadEmbeddedImages is equal to: " + ihg_Globals.downloadEmbeddedImages + "\n");
	
	ihg_Globals.minEmbeddedHeight = ihg_Globals.prefManager.getIntPref("extensions.imagegrabber.minembeddedheight");
	ihg_Globals.minEmbeddedWidth = ihg_Globals.prefManager.getIntPref("extensions.imagegrabber.minembeddedwidth");
 	ihg_Functions.LOG("In " + myself + ", ihg_Globals.minEmbeddedHeight is equal to: " + ihg_Globals.minEmbeddedHeight + "\n");
 	ihg_Functions.LOG("In " + myself + ", ihg_Globals.minEmbeddedWidth is equal to: " + ihg_Globals.minEmbeddedWidth + "\n");
	
	ihg_Globals.minFileSize = ihg_Globals.prefManager.getIntPref("extensions.imagegrabber.minfilesize");
	ihg_Globals.minFileSize *= 1024;
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.minFileSize is equal to: " + ihg_Globals.minFileSize + "\n");

	ihg_Globals.createDocTitSF = ihg_Globals.prefManager.getBoolPref("extensions.imagegrabber.createdoctitlesubfolder");
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.createDocTitSF is equal to: " + ihg_Globals.createDocTitSF + "\n");

	ihg_Globals.createPageDirs = ihg_Globals.prefManager.getBoolPref("extensions.imagegrabber.createpagedirs");

	ihg_Globals.prefManager.setBoolPref("extensions.imagegrabber.killmenow", false);

	ihg_Globals.hostFileLoc = ihg_Globals.prefManager.getCharPref("extensions.imagegrabber.hostfileloc");
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.hostFileLoc is equal to: " + ihg_Globals.hostFileLoc + "\n");

	ihg_Globals.prefix_fileNames = ihg_Globals.prefManager.getBoolPref("extensions.imagegrabber.prefixfilenames");
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.prefix_fileNames is equal to: " + ihg_Globals.prefix_fileNames + "\n");

	ihg_Globals.prefix_directories = ihg_Globals.prefManager.getBoolPref("extensions.imagegrabber.prefixdirectories");
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.prefix_directories is equal to: " + ihg_Globals.prefix_directories + "\n");

	ihg_Globals.cacheDLWin = ihg_Globals.prefManager.getBoolPref("extensions.imagegrabber.cachedlwin");
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.cacheDLWin is equal to: " + ihg_Globals.cacheDLWin + "\n");
	
	ihg_Globals.hostfAutoUpdate = ihg_Globals.prefManager.getBoolPref("extensions.imagegrabber.hostfautoupdate");
 	ihg_Functions.LOG("In " + myself + ", ihg_Globals.hostfAutoUpdate is equal to: " + ihg_Globals.hostfAutoUpdate + "\n");
	
	ihg_Globals.hostfUpdateConfirm = ihg_Globals.prefManager.getBoolPref("extensions.imagegrabber.hostfupdateconfirm");
 	ihg_Functions.LOG("In " + myself + ", ihg_Globals.hostfUpdateConfirm is equal to: " + ihg_Globals.hostfUpdateConfirm + "\n");
	
	ihg_Globals.hostfMergeBehavior = ihg_Globals.prefManager.getCharPref("extensions.imagegrabber.hostfmergebehavior");
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.hostfMergeBehavior is equal to: " + ihg_Globals.hostfMergeBehavior + "\n");
	
	ihg_Globals.autoCloseWindow = ihg_Globals.prefManager.getBoolPref("extensions.imagegrabber.autoclosewindow");
 	ihg_Functions.LOG("In " + myself + ", ihg_Globals.autoCloseWindow is equal to: " + ihg_Globals.autoCloseWindow + "\n");

	ihg_Functions.LOG("Exiting " + myself + "\n");
	}



//////////////////////   Initiliaze the variables //////////////////////////
ihg_Functions.initVars = function initVars(skipDirDialog) {
	var myself = String(arguments.callee).match(/(function.*)\(.*\)[\n\s]*{/m)[1];
	ihg_Functions.LOG("Entering " + myself + "\n");

	var doc = content.document;
	
	ihg_Globals.docTitle = doc.title.replace(/[\\/:*?"<>|,]/g, '').replace(/\./g,'').replace(/ - Mozilla Firefox$/,'');

	if (ihg_Globals.docTitle.length > 89) ihg_Globals.docTitle = ihg_Globals.docTitle.substring(0, 89);

	ihg_Globals.docTitle = ihg_Globals.docTitle.replace(/\s+$/, '');

	ihg_Functions.LOG("In " + myself + ", about to call getIGPrefs().\n");
	ihg_Functions.getIGPrefs();

	if (ihg_Globals.showDLDir && !skipDirDialog) {
		
		ihg_Functions.LOG("In " + myself + ", about to get ihg_Globals.baseDirSave\n");

		ihg_Globals.baseDirSave = ihg_Functions.setDownloadDir(ihg_Globals.strings.setDownloadDir, ihg_Globals.lastDLDir);
		if (!ihg_Globals.baseDirSave) {
			ihg_Functions.LOG("In " + myself + ", user cancelled the request.\n");
			return false; }
		ihg_Globals.prefManager.setCharPref("extensions.imagegrabber.lastdldir", ihg_Globals.baseDirSave);
		}
	else ihg_Globals.baseDirSave = ihg_Globals.lastDLDir;
	ihg_Functions.LOG("In " + myself + ", ihg_Globals.baseDirSave is equal to: " + ihg_Globals.baseDirSave + "\n");

	if (ihg_Globals.suckMode && !skipDirDialog) {
		ihg_Functions.LOG("In " + myself + ", setting ihg_Globals.suckMode variables.\n");

		ihg_Globals.firstPage = parseInt(prompt(ihg_Globals.strings.firstPage,""));
		if (isNaN(ihg_Globals.firstPage)) {
			ihg_Functions.LOG("In " + myself + ", user cancelled the request.\n");
			return false; }

		ihg_Globals.lastPage = parseInt(prompt(ihg_Globals.strings.lastPage,""));
		if (isNaN(ihg_Globals.lastPage)) {
			ihg_Functions.LOG("In " + myself + ", user cancelled the request.\n");
			return false; }

		if (ihg_Globals.firstPage > ihg_Globals.lastPage) {
			alert(ihg_Globals.strings.the_first_page + " " + ihg_Globals.firstPage + ihg_Globals.strings.greather_than_last + " " + ihg_Globals.lastPage);
			ihg_Functions.LOG("In " + myself + ", quitting because ihg_Globals.firstPage > ihg_Globals.lastPage.\n");
			return false;
			}
		}
	else {
		ihg_Globals.firstPage = ihg_Functions.getCurPageNum();
		ihg_Functions.LOG("In " + myself + ", ihg_Globals.firstPage is equal to: " + ihg_Globals.firstPage + "\n");
		ihg_Globals.lastPage=ihg_Globals.firstPage;
		}
		
	// skipDirDialog is true when restoring a cached session, so we disable the auto update feature
	if (ihg_Globals.hostfAutoUpdate && !skipDirDialog) ihg_Functions.autoUpdate();

	ihg_Functions.LOG("Exiting " + myself + "\n");
	return true;
	}

ihg_Functions.read_locale_strings = function read_locale_strings() {
	ihg_Globals.strings.running = ihg_Globals.strbundle.getString("running");
	ihg_Globals.strings.page = ihg_Globals.strbundle.getString("page");
	ihg_Globals.strings.of = ihg_Globals.strbundle.getString("of");
	ihg_Globals.strings.waiting = ihg_Globals.strbundle.getString("waiting");
	ihg_Globals.strings.setDownloadDir = ihg_Globals.strbundle.getString("setDownloadDir");
	ihg_Globals.strings.firstPage = ihg_Globals.strbundle.getString("firstPage");
	ihg_Globals.strings.lastPage = ihg_Globals.strbundle.getString("lastPage");
	ihg_Globals.strings.the_first_page = ihg_Globals.strbundle.getString("the_first_page");
	ihg_Globals.strings.greather_than_last = ihg_Globals.strbundle.getString("greather_than_last");
	ihg_Globals.strings.debug_log_cleared = ihg_Globals.strbundle.getString("debug_log_cleared");
	ihg_Globals.strings.pick_a_folder = ihg_Globals.strbundle.getString("pick_a_folder");
	ihg_Globals.strings.failed_to_copy = ihg_Globals.strbundle.getString("failed_to_copy");
	ihg_Globals.strings.log_file_copied = ihg_Globals.strbundle.getString("log_file_copied");
	ihg_Globals.strings.cant_find_image = ihg_Globals.strbundle.getString("cant_find_image");
	ihg_Globals.strings.cant_find_new_host = ihg_Globals.strbundle.getString("cant_find_new_host");
	ihg_Globals.strings.file_already_exists = ihg_Globals.strbundle.getString("file_already_exists");
	ihg_Globals.strings.starting_download = ihg_Globals.strbundle.getString("starting_download");
	ihg_Globals.strings.download_of = ihg_Globals.strbundle.getString("download_of");
	ihg_Globals.strings.download_did_not_complete = ihg_Globals.strbundle.getString("download_did_not_complete");
	ihg_Globals.strings.error_from_server = ihg_Globals.strbundle.getString("error_from_server");
	ihg_Globals.strings.file_not_good = ihg_Globals.strbundle.getString("file_not_good");
	ihg_Globals.strings.downloading = ihg_Globals.strbundle.getString("downloading");
	ihg_Globals.strings.request_aborted = ihg_Globals.strbundle.getString("request_aborted");
	ihg_Globals.strings.request_failed = ihg_Globals.strbundle.getString("request_failed");
	ihg_Globals.strings.restarting_http = ihg_Globals.strbundle.getString("restarting_http");
	ihg_Globals.strings.error_in_request = ihg_Globals.strbundle.getString("error_in_request");
	ihg_Globals.strings.all_done = ihg_Globals.strbundle.getString("all_done");
	ihg_Globals.strings.starting_http = ihg_Globals.strbundle.getString("starting_http");
	ihg_Globals.strings.getting_link_information = ihg_Globals.strbundle.getString("getting_link_information");
	ihg_Globals.strings.dont_know_how = ihg_Globals.strbundle.getString("dont_know_how");
	ihg_Globals.strings.bailing = ihg_Globals.strbundle.getString("bailing");
	ihg_Globals.strings.pick_download_folder = ihg_Globals.strbundle.getString("pick_download_folder");
	ihg_Globals.strings.could_not_get_filename = ihg_Globals.strbundle.getString("could_not_get_filename");
	ihg_Globals.strings.failed_to_initialize = ihg_Globals.strbundle.getString("failed_to_initialize");
	ihg_Globals.strings.stopping_the_program = ihg_Globals.strbundle.getString("stopping_the_program");
	ihg_Globals.strings.reviving_the_program = ihg_Globals.strbundle.getString("reviving_the_program");
	ihg_Globals.strings.no_file_to_open_yet = ihg_Globals.strbundle.getString("no_file_to_open_yet");
	ihg_Globals.strings.enter_host_file_server = ihg_Globals.strbundle.getString("enter_host_file_server");
	ihg_Globals.strings.new_host_file_server = ihg_Globals.strbundle.getString("new_host_file_server");
	ihg_Globals.strings.pick_host_file = ihg_Globals.strbundle.getString("pick_host_file");
	ihg_Globals.strings.overwrite_mode = ihg_Globals.strbundle.getString("overwrite_mode");
	ihg_Globals.strings.select_host = ihg_Globals.strbundle.getString("select_host");
	ihg_Globals.strings.read_disclaimer = ihg_Globals.strbundle.getString("read_disclaimer");
	ihg_Globals.strings.closing = ihg_Globals.strbundle.getString("closing");
	ihg_Globals.strings.finished = ihg_Globals.strbundle.getString("finished");
	ihg_Globals.strings.updated_hostf_found = ihg_Globals.strbundle.getString("updated_hostf_found");
	ihg_Globals.strings.update_local_hostf = ihg_Globals.strbundle.getString("update_local_hostf");

}


ihg_Functions.showFilterDialog = function showFilterDialog(objLinks) {
	var params = { inn:{links:objLinks, firstPage:ihg_Globals.firstPage, lastPage:ihg_Globals.lastPage}, out:null };
	window.openDialog("chrome://imagegrabber/content/interfaces/filter.xul", 
			"ig-filter_win", "chrome, dialog, modal, resizable=yes", params);
    return params.out;
} 

