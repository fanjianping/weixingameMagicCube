import * as THREE from './threejs/three.js'
import BasicRubik from './object/Rubik.js'
// require('./threejs/OrbitControls.js')
//import './threejs/OrbitControls.js'
import TouchLine from './object/TuchLine.js'
const Context = canvas.getContext('webgl')

export default class Main {
  constructor() {
    this.context = Context;
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.devicePixelRatio = window.devicePixelRatio
    this.viewCenter = new THREE.Vector3(0, 0, 0)
    this.frontViewName = 'front-rubik'; //正视角魔方名称
    this.endViewName = 'end-rubik'; //反视角魔方名称
    this.minPercent = 0.25; //正反视图至少占25%区域
    this.raycaster = new THREE.Raycaster(); //碰撞射线
    this.intersect = undefined; //射线碰撞的元素
    this.normalize = undefined; //滑动平面法向量
    this.targetRubik = undefined; //目标魔方
    this.anotherRubik = undefined; //非目标魔方
    this.startPoint = undefined; //触摸点
    this.movePoint = undefined; //滑动点
    this.isRotating = false; //魔方是否正在转动
    this.initRender()
    this.initCamera()
    this.initScene()
    this.initLight()
    this.initObject()
    this.initEvent()
    this.render()
  }
  initRender() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      context: this.context
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setClearColor(0xFFFFFF, 1.0);
    canvas.width = this.width * this.devicePixelRatio;
    canvas.height = this.height * this.devicePixelRatio;
    this.renderer.setPixelRatio(this.devicePixelRatio);
  }
  initCamera() {
    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 1, 1500);
    this.camera.position.set(0, 0, 300 / this.camera.aspect);
    this.camera.up.set(0, 1, 0); //正方向
    this.camera.lookAt(this.viewCenter);

    //透视投影相机视角为垂直视角，根据视角可以求出原点所在裁切面的高度，然后已知高度和宽高比可以计算出宽度
    this.originHeight = Math.tan(22.5 / 180 * Math.PI) * this.camera.position.z * 2;
    this.originWidth = this.originHeight * this.camera.aspect;

    // this.orbitController = new THREE.OrbitControls(this.camera, this.renderer.domElement)
    // this.orbitController.enableZoom = false
    // this.orbitController.rotateSpeed = 2
    // this.orbitController.target = this.viewCenter

  }
  initScene() {
    this.scene = new THREE.Scene()
  }
  initLight() {
    this.light = new THREE.AmbientLight(0xfefefe)
    this.scene.add(this.light)
  }
  initObject() {
    //正视角魔方
    this.frontRubik = new BasicRubik(this);
    this.frontRubik.initmodel(this.frontViewName);
    this.frontRubik.resizeHeight(0.5, 1);

    //反视角魔方
    this.endRubik = new BasicRubik(this);
    this.endRubik.initmodel(this.endViewName);
    this.endRubik.resizeHeight(0.5, -1);
    //滑动控制条
    this.touchLine = new TouchLine(this);

  }
  render() {
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)
    requestAnimationFrame(this.render.bind(this), canvas)
  }
  /**
   * 初始化事件
   */
  initEvent() {
    wx.onTouchStart(this.touchStart.bind(this))
    wx.onTouchMove(this.touchMove.bind(this))
    wx.onTouchEnd(this.touchEnd.bind(this))
  }
  /**
   * 触摸开始
   */
  touchStart(event) {
    let touch = event.touches[0];
    this.startPoint = touch;
    if (this.touchLine.isHover(touch)) {
      this.touchLine.enable();
    } else {
      this.getIntersects(event)
      if (!this.isRotating && this.intersect) {
        this.startPoint = this.intersect.point
      }
    }
  }
  /**
   * 触摸移动
   */
  touchMove(event) {
    // debugger
    let touch = event.touches[0];
    if (this.touchLine.isActive) {
      this.touchLine.move(touch.clientY)
      let frontPercent = touch.clientY / window.innerHeight;
      let endPercent = 1 - frontPercent;
      this.rubikResize(frontPercent, endPercent);
    } else {
      this.getIntersects(event)
      if (!this.isRotating && this.startPoint && this.intersect) { //滑动点在魔方上且魔方没有转动
        this.movePoint = this.intersect.point
        if (!this.movePoint.equals(this.startPoint)) {//触摸点和滑动点不一样则意味着可以得到滑动方向
          this.rotateRubik()
        }
      }
    } 
  }
  /**
   * 触摸结束
   */
  touchEnd() {
    this.touchLine.disable();
  }
  
  /**
   * 正反魔方区域占比变化
   */
  rubikResize(frontPercent, endPercent) {
    this.frontRubik.resizeHeight(frontPercent, 1);
    this.endRubik.resizeHeight(endPercent, -1);
  }
  /**
   * 获取操作魔方时的触摸点坐标以及该触摸点所在平面的法向量
   */
  getIntersects(event) {
    let touch = event.touches[0]
    let mouse = new THREE.Vector2()
    mouse.x = (touch.clientX / this.width) * 2 - 1
    mouse.y = -(touch.clientY / this.height) * 2 + 1
    this.raycaster.setFromCamera(mouse, this.camera)
    let rubikTypeName = ''
    let targetIntersect
    if (this.touchLine.screenRect.top > touch.clientY) {
      this.targetRubik = this.frontRubik
      this.anotherRubik = this.endRubik
      rubikTypeName = this.frontViewName
    } else if (this.touchLine.screenRect.top + this.touchLine.screenRect.height < touch.clientY) {
      this.targetRubik = this.endRubik
      this.anotherRubik = this.frontRubik
      rubikTypeName = this.endViewName
    }
    for (let child of this.scene.children) {
      if (child.childType === rubikTypeName) {
        targetIntersect = child
        break
      }
    }
    if (targetIntersect) {
      let intersects = this.raycaster.intersectObjects(targetIntersect.children)
      if (intersects.length >= 2) {
        if (intersects[0].object.cubeType === 'coverCube') {
          this.intersect = intersects[1]
          this.normalize = intersects[0].face.normal
        } else {
          this.intersect = intersects[0]
          this.normalize = intersects[1].face.normal
        }
      }
    }
  }
  /**
   * 转动魔方
   */
  rotateRubik(){
    let self=this
    this.isRotating=true//转动标识设置为true
    let sub=this.movePoint.sub(this.startPoint)//计算滑动方向
    let direction=this.targetRubik.getDirection(sub,this.normalize)//计算转动方向
    let cubeIndex=this.intersect.object.cubeIndex
    this.targetRubik.rotateMove(cubeIndex,direction)
    let anotherIndex=cubeIndex-this.targetRubik.minCubeIndex+this.anotherRubik.minCubeIndex//转动另一个魔方
    this.anotherRubik.rotateMove(anotherIndex,direction,()=>{
      self.resetRotateParams()
    })
  }
  /**
   * 重置魔方参数
   */
  resetRotateParams(){
    this.isRotating = false;
    this.targetRubik = undefined;
    this.anotherRubik = undefined;
    this.intersect = undefined;
    this.normalize = undefined;
    this.startPoint = undefined;
    this.movePoint = undefined;
  }
}