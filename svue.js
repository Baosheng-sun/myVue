
//这个类用来编译模板
class Compile{
	constructor(el, vm) {
		this.$vm = vm;
		this.$el = document.querySelector(el);
		if(this.$el){
			//调用node2Fragment方法,创建文档碎片
			this.$fragment = this.node2Fragment(this.$el);
			//调用compileElement方法,编译模板
			this.compileElement(this.$fragment);
			//把编译后的模板,插进html里
			this.$el.appendChild(this.$fragment)
		}
	}
	
	//创建文档碎片 虚拟节点
	node2Fragment(el){
		let fragment = document.createDocumentFragment();
		let child;
		while(child = el.firstChild){
			fragment.appendChild(child)
		}
		return fragment
	}
	
	//编译对应模板
	compileElement(el){
		const childNodes = el.childNodes;
		 Array.from(childNodes).forEach(node=>{
			let text = node.textContent;
			let reg = /\{\{(.*)\}\}/;
			
			if(this.isElement(node)){
				//当前节点是个元素
				this.compile(node)
			}else if(this.isTextNode(node) && reg.test(text)){
				//当前节点是个文本
				this.compileText(node, RegExp.$1);
			}
			
			//当前节点有子节点
			if(node.childNodes && node.childNodes.length){
				this.compileElement(node)
			}
		 })
	}
	
	
	compile(node){
		//节点是个元素,遍历元素的属性
		let nodeAttrs = node.attributes;
		Array.from(nodeAttrs).forEach(attr=>{
			const attrName = attr.name;
			let exp = attr.value;
			if(this.isDirective(attrName)){
				//如果属性名是个指令 例如s-text s-html等
				let dir = attrName.substring(2); //s-text ==> text
				this[dir](node, this.$vm, exp);
			}
			if(this.isEventDirective(attrName)){
				//如果属性名是个方法  @
				let dir = attrName.substring(1);  //@click ==> click
				this.eventHandle(node, this.$vm, exp, dir);
			}
		})
	}
	
	//处理元素绑定的方法
	eventHandle(node, vm, exp, dir){
		let fn = vm.$options.methods[exp]; //取到methods中定义的方法
		if(dir && fn){
			node.addEventListener(dir, fn.bind(vm), false);
		}
	}
	
	text(node, vm, exp){
		this.update(node, vm, exp, 'text')
	}
	html(node, vm, exp){
		this.update(node, vm, exp, 'html')
	}
	model(node, vm, exp){
		this.update(node, vm, exp, 'model');
		
		let val = vm.exp;
		let fn = function(e) {
			let newValue = e.target.value
			vm[exp] = newValue
			val = newValue
		}
		node.addEventListener('input',e=> {
			let newValue = e.target.value
			vm[exp] = newValue
			val = newValue
		});
	}
	
	update(node, vm, exp, dir){
		// 统一处理 添加监听器
		const updateFn = this[dir + 'Updater'];
		updateFn && updateFn(node, vm[exp]);
		
		new Watcher(vm, exp, function(val){
			//每次有数据变化,就执行
			updateFn && updateFn(node, vm[exp]);
		})
	}
	
	textUpdater(node, val){
		node.textContent = val;
	}
	htmlUpdater(node, val){
		node.innerHTML = val;
	}
	modelUpdater(node, val){
		node.value = val;
	}
	isDirective(attr){
		return attr.indexOf('s-') === 0
	}
	isEventDirective(attr){
		return attr.indexOf('@') === 0
	}
	
	//处理文本节点
	compileText(node, exp){
		this.text(node, this.$vm, exp)
	}
	
	isElement(node){
		return node.nodeType == 1
	}
	isTextNode(node){
		return node.nodeType == 3
	}
}

// 这个类用来做依赖收集
class Dep{
	constructor() {
	    this.deps = [];
	}
	
	//增加一个依赖收集器(监听器)
	addDep(dep){
		this.deps.push(dep)
	}
	
	notify(){
		this.deps.forEach(dep => {
			// dep都是监听器
			dep.update()
		})
	}
}

//这个类做监听
class Watcher{
	constructor(vm, key, cb) {
		this.cb = cb;
		this.vm = vm;
		this.key = key;
		this.val = this.get();
	    // Dep.target = this;
	}
	
	get(){
		Dep.target = this;
		let val = this.vm[this.key];
		return val
	}
	
	update(){
		this.val = this.get();
		this.cb.call(this.vm, this.val);
		// console.log('视图更新了')
	}
}


//这个是svue类
class SVue{
	// 构造函数,实例化就执行
	constructor(options){
		this.$data = options.data;
		this.$options = options;
		this.observer(this.$data);
		// new Watcher()
		this.$compile = new Compile(options.el, this)
	}
	
	observer(value){
		// 这个方法遍历data里面的所有key
		Object.keys(value).forEach(key=>{
			this.proxyData(key);
			this.defineReacttive(value, key, value[key]);
		})
	}
	
	//代理data,用户直接修改this.属性名姐可以获取属性,不用使用this.$data.属性名
	proxyData(key){
		Object.defineProperty(this,key,{
			get(){
				return this.$data[key]
			},
			set(newVal){
				this.$data[key] = newVal;
			}
		})
	}
	
	defineReacttive(obj, key, val){
		// 这个方法监听data里面所有key
		const dep = new Dep(); //每一个数据都新建一个依赖
		Object.defineProperty(obj,key,{
			get(){
				//收集依赖
				Dep.target && dep.addDep(Dep.target)
				return val
			},
			set(newVal){
				// console.log('尝试修改name',newVal)
				if(newVal === val) return
				val = newVal;
				dep.notify()
			}
		})
	}
}