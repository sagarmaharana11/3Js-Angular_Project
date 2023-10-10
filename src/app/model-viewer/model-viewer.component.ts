import { Component, ElementRef, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { BloomEffect, EffectComposer, EffectPass, RenderPass } from 'postprocessing';
import { MeshPhysicalMaterial } from 'three';


@Component({
  selector: 'app-model-viewer',
  templateUrl: './model-viewer.component.html',
  styleUrls: ['./model-viewer.component.css']
})
export class ModelViewerComponent implements OnInit, AfterViewInit {
  @ViewChild('rendererContainer', { static: true }) rendererContainer!: ElementRef;
  @ViewChild('colorInput') colorInput!: ElementRef;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls | undefined;
  private light: THREE.PointLight;
  private secondLight: THREE.PointLight; // New second light
  private lightHelper: THREE.Object3D | undefined;
  private secondLightHelper: THREE.Object3D | undefined; // New second light helper
  private bloomComposer: EffectComposer;

  private cameraRadius = 5; // Radius of the circular path
  private minCameraRadius = 2; // Minimum camera zoom distance
  private maxCameraRadius = 20; // Maximum camera zoom distance
  private cameraAngle = 0; // Initial camera angle
  private zoomSpeed = 0.1; // Adjust the zoom speed as needed

  private rotateCamera = false; // Flag to control camera rotation

  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.shadowMap.enabled = true; // Enable shadows in the renderer
    this.light = new THREE.PointLight(0xffffff, 5);
    this.light.position.set(1, 1, 2);
    this.light.castShadow = true; // Enable shadow casting for the light

    // Create a second point light
    this.secondLight = new THREE.PointLight(0xffd700, 10); // Change color to golden and increase intensity
    this.secondLight.position.set(0, 3, 0); // Adjust the position as needed
    this.secondLight.distance = 10; // Increase the distance of the light
    this.secondLight.castShadow = true; // Enable shadow casting for the second light

    // Initialize bloom effect
    const bloomEffect = new BloomEffect({
      luminanceThreshold: 0.6, // Adjust as needed
      luminanceSmoothing: 0.9, // Adjust as needed
      intensity: 2, // Adjust as needed
    });

    this.bloomComposer = new EffectComposer(this.renderer);
    this.bloomComposer.addPass(new RenderPass(this.scene, this.camera));
    const bloomPass = new EffectPass(this.camera, bloomEffect);
    this.bloomComposer.addPass(bloomPass);
  }

  ngOnInit(): void {
    this.initThree();
    this.addGlobalLight();
    this.addInfinitePlane();
  }

  ngAfterViewInit(): void {
    this.loadModel();
    this.addControls();
    this.renderer.setClearColor("black"); 
    this.scene.add(this.light);
    this.lightHelper = this.createLightHelper(this.light);

    // Add the second light to the scene
    this.scene.add(this.secondLight);

    // Create a light helper for the second light
    this.secondLightHelper = this.createLightHelper(this.secondLight);

    // Add event listener for mouse wheel to handle zooming
    this.rendererContainer.nativeElement.addEventListener('wheel', (event: WheelEvent) => {
      this.onMouseWheel(event);
    });

    // Add event listener for right-click to move the light
    this.rendererContainer.nativeElement.addEventListener('contextmenu', (event: MouseEvent) => {
      event.preventDefault(); // Prevent the default context menu
      this.onRightMouseClick(event);
    });

    // Set the size of the bloomComposer's target to match the renderer's size
    this.bloomComposer.setSize(window.innerWidth, window.innerHeight);

    // Add event listener for "R" key press to toggle camera rotation
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') {
        this.rotateCamera = !this.rotateCamera;
        if (this.rotateCamera && this.controls) {
          this.controls.autoRotate = true; // Enable camera rotation
        } else if (this.controls) {
          this.controls.autoRotate = false; // Disable camera rotation
        }
      }
    });

    // Add event listener for left-click to stop camera rotation
    this.rendererContainer.nativeElement.addEventListener('mousedown', (event: MouseEvent) => {
      if (event.button === 0 && this.controls) {
        this.controls.autoRotate = false;
      }
    });

    // Start the animation loop
    this.animate();
  }

  initThree() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.position.z = 5;
    this.rendererContainer.nativeElement.appendChild(this.renderer.domElement);
  }

  loadModel() {
    const loader = new GLTFLoader();

    const loadingManager = new THREE.LoadingManager(() => {
      console.log('All assets loaded.');
    });

    loadingManager.onProgress = (item, loaded, total) => {
      console.log(`Loading ${item} - ${loaded} of ${total}`);
    };

    loader.load(
      'assets/bus.glb',
      (gltf) => {
        const model = gltf.scene;

        // Adjust the position to place the model on top of the plane
        model.position.set(0, -0.84, 0); // Adjust the Y value to position it correctly
        model.scale.set(1, 1, 1);

        // Enable shadow receiving for the model
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        this.scene.add(model);
      },
      undefined,
      (error) => {
        console.error('Error loading GLTF model:', error);
      }
    );
  }

  addControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.25;
    this.controls.rotateSpeed = 0.35;
  }

  onMouseWheel(event: WheelEvent) {
    // Adjust the camera radius (zoom) based on the scroll direction
    this.cameraRadius -= event.deltaY * this.zoomSpeed; // Adjust the zoom speed as needed

    // Limit the camera zoom to the specified range
    this.cameraRadius = Math.min(Math.max(this.cameraRadius, this.minCameraRadius), this.maxCameraRadius);
  }

  onRightMouseClick(event: MouseEvent) {
    // Calculate the mouse position in normalized device coordinates (NDC)
    const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
  
    // Create a raycaster from the camera's position
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), this.camera);
  
    // Find the intersection point between the ray and the scene
    const intersects = raycaster.intersectObject(this.scene, true);
  
    if (intersects.length > 0) {
      // Get the position of the first intersection
      const newPosition = intersects[0].point;
  
      // Update the light's position
      this.updateLightPosition(newPosition.x, newPosition.y, newPosition.z);
    }
  }
  

  updateLightPosition(x: number, y: number, z: number) {
    this.light.position.set(x, y, z);
    if (this.lightHelper) {
      this.lightHelper.position.copy(this.light.position);
    }
  }

  createLightHelper(light: THREE.Light) {
    const helper = new THREE.PointLightHelper(light as THREE.PointLight, 0.2);
    this.scene.add(helper);
    return helper;
  }

  newColor(inputElement: HTMLInputElement) {
    const colorValue = inputElement.value;
    const color = new THREE.Color(colorValue);
    this.changeLightColor(color);
  }

  changeLightColor(color: THREE.Color) {
    this.light.color.copy(color);
  }

  addGlobalLight() {
    const ambientLight = new THREE.AmbientLight(0x404040);
    this.scene.add(ambientLight);
  
    // Create a directional light (sun-like) with a white color
    const sunLight = new THREE.DirectionalLight(0xffffff, 5);
  
    // Calculate the direction vector for a 35-degree angle
    const angleInRadians = (35 * Math.PI) / 180;
    const x = Math.cos(angleInRadians);
    const y = Math.sin(angleInRadians);
  
    // Set the direction of the light
    sunLight.position.set(x, y, 2); // Adjust the position as needed
    sunLight.castShadow = true; // Enable shadow casting for the light
  
    this.scene.add(sunLight);
  }
  
  

  addInfinitePlane() {
    const groundGeometry = new THREE.PlaneGeometry(100000, 100000);
    
    // Use MeshPhysicalMaterial for the wet surface
    const groundMaterial = new MeshPhysicalMaterial({
      color: 0x808080,
      roughness: 0.8,
      metalness: 0.2,
      reflectivity: 0.9, // Increase reflectivity for wetness
      clearcoat: 0.2,    // Add clearcoat for a wet look
    });
  
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1;
    ground.receiveShadow = true; // Enable shadow receiving for the ground
    this.scene.add(ground);
  }
  

  updateCameraPosition() {
    // Update camera position here if needed
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    // Update camera position on the circular path
    if (this.rotateCamera && this.controls) {
      this.controls.update(); // Rotate the camera if rotation is enabled
    }

    // Render the scene using the bloomComposer
    this.bloomComposer.render();
  }
}
