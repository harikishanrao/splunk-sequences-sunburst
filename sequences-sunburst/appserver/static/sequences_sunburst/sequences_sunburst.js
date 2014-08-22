//sequences sunburst
//
//available options
//step_field name of the field

define(function(require, exports, module) {

    var _ = require('underscore');
    var $ = require('jquery');
    var d3 = require("../d3/d3.min");
    var SimpleSplunkView = require("splunkjs/mvc/simplesplunkview");
    
    require("css!./sunburst.css");
    
    var Sunburst = SimpleSplunkView.extend({
        className: "sunburst",
        options: {
            managerId: null,
            data: "preview",
            step_field_name: null,
            size_field_name: "count"
        },
        output_mode: "json",
        
        initialize: function() {
            SimpleSplunkView.prototype.initialize.apply(this, arguments);
            this.settings.enablePush("value");

            // in the case that any options are changed, it will dynamically update
            // without having to refresh. copy the following line for whichever field
            // you'd like dynamic updating on
            this.settings.on("change:step_field_name", this.render, this);
            this.settings.on("change:size_field_name", this.render, this);

            // Set up resize callback. The first argument is a this
            // pointer which gets passed into the callback event
            $(window).resize(this, _.debounce(this._handleResize, 20));
        },
        _handleResize: function(e) {
            // e.data is the this pointer passed to the callback.
            // here it refers to this object and we call render()
            e.data.createView();
//            e.data.updateView();
            e.data.render();
        },
        createView: function() {
          var margin = {top:0, right:0, bottom:0, top:0};
          var availableWidth = parseInt(this.settings.get("width") || this.$el.width());
          if (this.settings.get("height") == "16/9") {
              var availableHeight = Math.floor(availableWidth * 9 / 16);
          }
          else if (this.settings.get("height") == "4/3") {
              var availableHeight = Math.floor(availableWidth * 3 / 4);
          }
          else {
              var availableHeight = parseInt(this.settings.get("height") || this.$el.height()); 
          }
          if (this.settings.get("explanation_text_line1") != null) {
              this.explanation_text_line1 = this.settings.get("explanation_text_line1");
              this.explanation_text_line2 = this.settings.get("explanation_text_line2") || "";
          } else {
              this.explanation_text_line1 = "of visits starts";
              this.explanation_text_line2 = "with this sequence";
          }
          this.trail_id = this.settings.get("trail_id") || "trail";
          
          this.radius = Math.min(availableWidth, availableHeight) / 2;
          // Breadcrumb dimensions: width, height, spacing, width of tip/tail.
          this.b = {w: 155, h: 30, s: 3, t: 10};
         
          var explanation_text = (this.settings.get("explanation_text")  || "of visits begin with this sequence");
          this.$el.html("");
          d3.select("#" + this.trail_id).select("svg").remove();;
          
          this.trail = d3.select("#" + this.trail_id).append("svg")
              .attr("width", availableWidth)
              .attr("height",50);
          this.trail_end = this.trail.append("text")
              .attr("class","trail-end");
              

          
          d3.select(this.el).selectAll(".percentage")
              .style("top",Math.floor(availableHeight / 2) + "px")
              .style("position","absolute");

          this.svg = d3.select(this.el)
              .append("svg")
              .attr("width", availableWidth)
              .attr("height", availableHeight)
              .attr("pointer-events", "all");
         
          
           
          
          this.colors = d3.scale.category20b();

          this.vis = this.svg
              .append("g")
              .attr("class", "viscontainer")
              .attr("transform", "translate(" + availableWidth / 2 + "," + availableHeight / 2 + ")");
          

          this.arc = d3.svg.arc()
              .startAngle(function(d) { return d.x; })
              .endAngle(function(d) { return d.x + d.dx; })
              .innerRadius(function(d) { return Math.sqrt(d.y); })
              .outerRadius(function(d) { return Math.sqrt(d.y + d.dy); });

          this.vis.append("circle")
              .attr("r", this.radius)
              .style("opacity", 0);

          this.explanation_group = this.vis.append("g")
              .style("visibility","hidden")
              .attr("class","explanation-group");
          
          this.percent_text_element = this.explanation_group.append("text")
              .attr("x",0)
              .attr("y",-5)
              .attr("class","percentage-text")
              .text("");
          this.explanation_text_line1_element = this.explanation_group.append("text")
              .attr("x",0)
              .attr("y",+15)
              .attr("class","explanation-text explanation-text-line1")
              .text(this.explanation_text_line1);
          this.explanation_text_line2_element = this.explanation_group.append("text")
              .attr("x",0)
              .attr("y",+30)
              .attr("class","explanation-text explanation-text-line2")
              .text(this.explanation_text_line2);
           
          // ez megy majd visza vis_ben
          return {container: this.$el, svg: this.svg, margin: margin}

        },
        formatData: function(data) {
            this.step_field_name = this.settings.get("step_field_name");
            this.size_field_name = this.settings.get("size_field_name");
           
            var hier = this.buildHierarchy(data);
            

//           var sunburst_data = nodes;
            sunburst_data = hier;
            return sunburst_data;
        },
        updateView: function(viz, data) {
            
            var that = this;
            //svg.empty();
            this.partition = d3.layout.partition()
                .size([2 * Math.PI, this.radius * this.radius])
                .value(function(d) {return d.size; });

            var nodes = this.partition.nodes(data)
                .filter(function(d) { return (d.dx > 0.005); }); // 0.005 radians = 0.29 degrees
           
            this.vis.data([data]).selectAll("path").remove();
            var path = this.vis.data([data]).selectAll("path")
                .data(nodes)
                .enter().append("path")
                .attr("display", function(d) { return d.depth ? null : "none"; })
                .attr("d", that.arc)
                .attr("fill-rule", "evenodd")
                .style("fill", function(d) { return that.colors(d.name); })
                .style("opacity", 1)
                .on("mouseover", function(d) { return that.mouseover(that,d); })
            d3.select(this.el).selectAll(".viscontainer").on("mouseleave", function(d) { return that.mouseleave(that,d);});
            this.totalSize = path.node().__data__.value;

        },
        getAncestors: function(node) {
            var path = [];
            var current = node;
            while (current.parent) {
                path.unshift(current);
                current = current.parent;
            }
            return path;
        },
        breadcrumbPoints: function(obj,d, i) {
            var points = [];
            points.push("0,0");
            points.push(obj.b.w + ",0");
            points.push(obj.b.w + obj.b.t + "," + (obj.b.h / 2));
            points.push(obj.b.w + "," + obj.b.h);
            points.push("0," + obj.b.h);
            if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
                points.push(obj.b.t + "," + (obj.b.h / 2));
            }
            return points.join(" ");
        },
        updateBreadcrumbs: function(nodeArray,percentageString) {
            that = this;
            var g = this.trail.selectAll("g")
                        .data(nodeArray, function(d) { return d.name + d.depth; });
            var entering = g.enter().append("g");
            entering.append("polygon")
                .attr("points", function(d,i) { return that.breadcrumbPoints(that,d,i) })
                .style("fill", function(d) { return that.colors(d.name)});
            entering.append("text")
                .attr("x", (that.b.w + that.b.t) / 2)
                .attr("y", that.b.h / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .attr("class","trail-text")
                .text(function(d) { return d.name; });

            // Set position for entering and updating nodes.
            g.attr("transform", function(d, i) { return "translate(" + i * (that.b.w + that.b.s) + ", 0)"; });

            // Remove exiting nodes. 
            g.exit().remove();

            // Now move and update the percentage at the end.
            this.trail_end
                .attr("x", (nodeArray.length + 0.5) * (this.b.w + this.b.s))
                .attr("y", this.b.h / 2)
                .attr("dy", "0.35em")
                .attr("text-anchor", "middle")
                .text(percentageString);

            // Make the breadcrumb trail visible, if it's hidden.
            this.trail
                .style("visibility", "");
        },
        buildHierarchy: function(data) {
            var root = {"name": "root", "children": []};
            for (var i = 0; i < data.length; i++) {
                var sequence = data[i][this.step_field_name]; 
                var size = + data[i][this.size_field_name];
                var parts = sequence.split("-");
                var currentNode = root ;
                for (var j = 0; j < parts.length; j++) {
                    var children = currentNode["children"];
                    var nodeName = parts[j];
                    var childNode;
                    if (j + 1 < parts.length) {
                        // Not yet at the end of the sequence; move down the tree.
                        var foundChild = false;
                        for (var k = 0; k < children.length; k++) {
                            if (children[k]["name"] == nodeName) {
                                childNode = children[k];
                                foundChild = true;
                                break;
                            }
                        }
                        // If we don't already have a child node for this branch, create it.
                        if (!foundChild) {
                            childNode = {"name": nodeName, "children": []};
                            children.push(childNode);
                        }
                        currentNode = childNode;
                    } else {
                        // Reached the end of the sequence; create a leaf node.
                        childNode = {"name": nodeName, "size": size};
                        children.push(childNode);
                    }
                    
                }
            }
            return root;
        },
        mouseover: function(obj,d) {
            var percentage = (100 * d.value / obj.totalSize).toPrecision(3);
            var percentageString = percentage + "%";
            if (percentage < 0.1) {
                percentageString = "< 0.1%";
            }
            obj.percent_text_element
                .text(percentageString);

            obj.explanation_group
                .style("visibility","");
            obj.trail
                .attr("visibility","");
                        


            var sequenceArray = obj.getAncestors(d);
            this.updateBreadcrumbs(sequenceArray, percentageString);
 
            var vis = d3.select(obj.el);
            vis.selectAll("path")
                .style("opacity", 0.3);
            vis.selectAll("path")
                .filter(function(node) { 
                    return (sequenceArray.indexOf(node) >= 0);
                    })
                .style("opacity", 1);
        },
        mouseleave: function(obj,d) {
            var vis = d3.select(obj.el);
            vis.selectAll("path").on("mouseover", null);
            vis.selectAll("path")
                .transition(1000)
                .style("opacity", 1)
                .each("end", function() {
                    d3.select(this).on("mouseover", function(d) { return obj.mouseover(obj,d); });
                });
            obj.explanation_group
                .transition(1000)
                .style("visibility", "hidden");
            obj.trail
                .attr("visibility","hidden");
        }
        
    });
    return Sunburst;
});


