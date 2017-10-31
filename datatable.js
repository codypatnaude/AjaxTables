"use strict";

var dataTables = dataTable()

function dataTable(selector, config){

    if(window.dataTables){
        return window.dataTables.manageTables(selector, config)
    }

    var dataTableList = {}
    var ret = {}
    ret.manageTables = function(selector, config){
        //Check to see if the dataTable is already created for selector
        if(dataTableList[selector] !== undefined){
            if(config !== undefined){
                throw "You are trying to redifine dataTable " + selector + " which has already been defined"
            }

            return dataTableList[selector]
        }

        //If the table hasn't been created yet create it

        var newTbl = Create(selector, config)
        dataTableList[selector] = newTbl
        return newTbl
    }

    return ret

    function Create(selector, config){

        //Create empty data table object
        var dt = {}
        dt.container = document.querySelector(selector)
        dt.inputs = []
        dt.searchValues = []
        dt.table = null
        dt.baseURL = null
        dt.resultSet = null
        dt.tableHead = null
        dt.columnHeaders = []
        dt.tableBody = null
        dt.loadingControl = null
        dt.orderby = null
        dt.rowTemplate = ''
        dt.isSearching = false
        dt.refresh = function(){
            UpdateResults()
        }

        //if config is passed in update dt with relevant data
        applyConfig()

        /*
        * Finds the table element as well as all the inputs and selects used for searching
        * Assigns dt.table and dt.inputs
        */
        getControls(dt.container)

        if(dt.table === null){
            throw dt.container.id + " doesn't have a table element"
        }

        //Creates div that will contain the paginator ul
        CreatePaginator()

        //Adds onchange and keyup event listeners to each dt.inputs so that SetSearchValue gets called when values change
        assignEventListenersToInputs()

        //retrieves the table body and sets dt.rowTemplate to the first row
        getTableElements()

        //Adds click events to the <th> elements to allow for sorting
        assignOnClickToHeaders()

        //gets the initial values from dt.inputs
        setInitialSearchValues()
        //display the resultset
        if(dt.resultSet){
            DisplayResults()
        }

        //Hides the dt.LoadingControl
        stopSearch()
        
        if(Object.keys(dt.searchValues).length > 0 && !dt.resultSet){
            UpdateResults()
        }

        function ChangeSort(event){

            var target = event.target
            var sortvalue = target.attributes['orderby'].value
            var sortDirection = 'ASC'
            if(target.attributes['sortdirection']){
                sortDirection = target.attributes['sortdirection'].value

                if(sortDirection === 'ASC'){
                    sortDirection = 'DESC'
                }else{
                    sortDirection = 'ASC'
                }
            }

            var sortChar = '&uarr;'
            if(sortDirection == 'DESC'){
                sortChar = '&darr;'
            }

            target.setAttribute('sortdirection', sortDirection)

            dt.searchValues['ORDERBY'] = sortvalue + " " + sortDirection
            
            dt.columnHeaders.forEach(function(elem){
                setSortArrow(elem, '')
            })
            
            setSortArrow(target, sortChar)
            dt.searchValues['PAGE'] = 1
            UpdateResults()
            
        }

        function setSortArrow(node, char){
            var html = node.innerHTML
            if(char === ''){
                html = html.replace(/(&.arr;|↑|↓)/, '')
            }else{
                if(html.match(/(&.arr;|↑|↓)/) != null){
                    html = html.replace(/(&.arr;|↑|↓)/, char)
                }else{
                    html += char
                }
            }

            node.innerHTML = html
        }

        function assignOnClickToHeaders(node){
            var target = dt.tableHead
            if(node){
                target = node
            }
            
            target.childNodes.forEach(function(child){
                var name = child.nodeName
                if(name === 'TH'){
                    var sortvalue = null
                    if(child.attributes['orderby']){
                        sortvalue = child.attributes['orderby'].value
                    }
                    var sortDirection = null
                    if(child.attributes['sortdirection']){
                        sortDirection = child.attributes['sortdirection'].value
                    }

                    if(!sortvalue){
                        return
                    }

                    child.addEventListener('click', ChangeSort)
                    dt.columnHeaders.push(child);
                }else if(child.hasChildNodes()){
                    assignOnClickToHeaders(child)
                }
            })
        }

        function assignEventListenersToInputs(){
            
            for(var i=0;i<dt.inputs.length;i++){
                var target = dt.inputs[i]
                var event = ""
                if(target.nodeName === 'SELECT'){
                    event = "change"
                }else{
                    event = "keyup"
                }
                target.addEventListener(event, SetSearchValue)

            }
        }    

        
        function getTableElements(){
            //get table row template, table body and table header

            dt.table.childNodes.forEach(function(child){
                var name = child.nodeName
                if(name === 'THEAD'){
                    dt.tableHead = child
                }else if(name === 'TBODY'){
                    dt.rowTemplate = child.innerHTML
                    dt.tableBody = child
                    child.innerHTML = ''
                }
            })
        }

        
        function applyConfig(){
            //apply settings
            if(config){
                if(config.hasOwnProperty('base_url')){
                    dt.baseURL = config.base_url
                }
                if(config.hasOwnProperty('result_set')){
                    dt.resultSet = config.result_set
                }
                if(config.hasOwnProperty('search_values')){
                    dt.searchValues = config.search_values
                }
            }
        }
        
        function setInitialSearchValues(){
            //get initial search values
            for(var i=0;i<dt.inputs.length;i++){
                var elem = dt.inputs[i]
                var val = elem.value
                if((typeof val === 'string' && val.length > 0) || (typeof val === 'boolean')){
                    dt.searchValues[elem.name] = val
                }
            }
        }

        function startSearch(){
            dt.isSearching = true

            if(dt.loadingControl){
                dt.loadingControl.hidden = false
            }
        }
        
        function stopSearch(){
            dt.isSearching = false

            if(dt.loadingControl){
                dt.loadingControl.hidden = true
            }
        }

        function DisplayResults(){
            var html = ''
            if(typeof dt.resultSet === 'object' && !Array.isArray(dt.resultSet)){
                dt.resultSet = [dt.resultSet]
            }

            if(Array.isArray(dt.resultSet)){
                dt.resultSet.forEach(function($record, $index){

                    var curHtml = dt.rowTemplate.replace(/(\[\[)(.*?)(\]\])/g, function(match){
                        var field = match.replace('[[', '').replace(']]', '')
                        var code = ''
                        var ret = ''
                        try{
                            if(field.substring(0, 5) === "eval="){
                                code = field.trim()
                                code = code.substring(6, code.length - 1)
                                ret = eval(code)
                            }else{
                                field = field.split('.')
                                ret = $record
                                field.forEach(function(key){
                                    if(ret){
                                        ret = ret[key]
                                    }
                                })
                                
                            }
                            return (ret === null || ret === undefined) ? '' : ret
                        }catch(e){
                            console.log(field)
                            console.log(code)
                            console.log(e)
                            return "ERROR: " + e
                        }
                        
                    })
                    html += curHtml
                })
            }
            dt.tableBody.innerHTML = html
        }

        function SetSearchValue(event){
            var name   = event.target.name
            var newVal = event.target.value
            var fuzzySearch = !!event.target.getAttribute('fuzzy-search')
            var oldVal = dt.searchValues[name]

            //Check to see if we actually have a value
            if(newVal === undefined || newVal === null || newVal === ''){
                if(oldVal !== undefined){
                    //remove the search filter
                    delete dt.searchValues[name]
                }else{
                    //User did not type a meaningful character... bail
                    return
                }
            }else{
                //Add wildcards to newVal for fuzzy search
                if(fuzzySearch){
                    newVal += '%'
                }

                //check to see if the new value is different from the old value
                if(oldVal === newVal){
                    //field value didn't change, ignore
                    return
                }

                dt.searchValues[name] = newVal
            }
            DebounceThenUpdate(500)
        }

        function DebounceThenUpdate(waitTime){
            if(waitTime){
                dt.debounceCounter = waitTime;
                if(dt.debounceTimeout !== undefined){
                    return;
                }
            }
            
            if(dt.debounceCounter <= 0){
                delete dt.debounceTimeout;
                UpdateResults()
            }else{
                dt.debounceCounter -= 10
                dt.debounceTimeout = setTimeout(DebounceThenUpdate, 10)
            }
        }

        function UpdateResults(){
            var query = '?'
            var delimiter = ''
            for(var k in dt.searchValues){
                query += delimiter + k + "=" + encodeURIComponent(dt.searchValues[k])
                delimiter = '&'
            }
            startSearch()
            $.get(dt.baseURL + query, function(data){
                dt.resultSet = data.subset
                dt.currentPage = data.pos + 1
                dt.pageSize = data.limit
                dt.totalResults = data.total
                dt.totalPages = data.count
                DisplayResults()
                UpdatePaginator()
                stopSearch()
            })
        }

        function CreatePaginator(){
            var paginator = document.createElement('div')
            paginator.setAttribute('class', 'page-selector')
            dt.tableWrapper.appendChild(paginator)
            dt.paginator = paginator
            dt.paginator.innerHTML
        }

        function UpdatePaginator(){
            dt.paginator.innerHTML = ''
            
            var startIndex = ((dt.currentPage - 1) * dt.pageSize) + 1
            var endIndex = Math.min(dt.totalResults, ((dt.currentPage - 1) * dt.pageSize) + dt.pageSize)
            var summaryInfo = document.createElement('div')
            summaryInfo.innerHTML = "Showing results " + startIndex + " - " + endIndex + " of " + dt.totalResults

            dt.paginator.appendChild(summaryInfo)

            var pageList = document.createElement('ul');
            for(var i=0;i<dt.totalPages;++i){
                var li = document.createElement('li')
                if(i+1 === dt.currentPage){
                    li.setAttribute('class', 'active');
                }
                li.innerHTML = i+1

                li.addEventListener('click', GetPageFromElement)
                pageList.appendChild(li);
            }

            dt.paginator.appendChild(pageList)
        }

        function GetPageFromElement(event){
            GetPage(event.target.innerHTML)
        }

        function GetPage(page){
            page = parseInt(page)
            
            page = Math.max(page, 1)

            dt.searchValues['PAGE'] = page

            UpdateResults()

        }


        //process nodes, add input, select nodes to search controls array
        //  add table to ret.table
        function getControls(elem){
            if(!elem.hasChildNodes()){
                return false
            }

            var children = elem.childNodes
            for(var i=0;i<children.length;i++){
                var child = children[i]
                var name = child.nodeName;
                
                if(name.substring(0, 1) === '#'){
                    continue;
                }

                if(child.classList.length > 0 && !dt.loadingControl){
                    for(var x=0;x < child.classList.length; x++){
                        if(child.classList[x] == 'search-indicator'){
                            dt.loadingControl = child
                            break;
                        }
                    }
                }

                if(name.toUpperCase() === 'SELECT' || name.toUpperCase() === 'INPUT'){
                    dt.inputs.push(child)
                }else if(name.toUpperCase() === 'TABLE'){
                    if(dt.table === null){
                        dt.tableWrapper = child.parentNode
                        dt.table = child
                        continue;
                    }else{
                        throw dt.container.id + " has more than one table!"
                    }
                }

                if(child.hasChildNodes()){
                    getControls(child)
                    continue;
                }
                
            }
        }

        return dt    

    }
}