import * as THREE from 'https://unpkg.com/three@0.127.0/build/three.module.js'

import { OrbitControls } from 'https://unpkg.com/three@0.127.0/examples/jsm/controls/OrbitControls.js' //This is a CDN to get orbit controls, which are an "addon" or an "example" that is not included with the main THREE library import above.

var width = window.innerWidth;
var height = window.innerHeight;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x000000, 200, 500);
scene.background = new THREE.Color(0x000000); //301934
var colorPlus = 0x000000;

const pointLight = new THREE.PointLight(0xffffff); //0x is a hexadecimal literal. It means we are working with hexadecimals.
pointLight.position.set(20, 20, 20);
const ambientLight = new THREE.AmbientLight(0xffffff); //Ambient light will light up everything evenly.
scene.add(pointLight, ambientLight);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector("#bg"), //We want to use the canvas with the ID of bg (background).
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);

camera.position.x = 0;
camera.position.y = 0;
camera.position.z = 0;

const geometry = new THREE.TorusGeometry(3, 0.13, 16, 100); //The vectors that make up an object.
const material = new THREE.MeshStandardMaterial({
    color: 0xFFA500,
}); //The wrapping paper to go around that object.
const torus = new THREE.Mesh(geometry, material) //Geometry + Material
scene.add(torus);
const geometry1 = new THREE.TorusGeometry(3, 0.13, 16, 100); //The vectors that make up an object.
const material1 = new THREE.MeshStandardMaterial({
    color: 0xFF0000,
}); //The wrapping paper to go around that object.
const torus1 = new THREE.Mesh(geometry1, material1) //Geometry + Material
scene.add(torus1);
const geometry2 = new THREE.TorusGeometry(3, 0.13, 16, 100); //The vectors that make up an object.
const material2 = new THREE.MeshStandardMaterial({
    color: 0x00FF00,
}); //The wrapping paper to go around that object.
const torus2 = new THREE.Mesh(geometry2, material2) //Geometry + Material
scene.add(torus2);

const controls = new OrbitControls(camera, renderer.domElement); //This will listen to dom events on the mouse, and update the camera position accordingly.

//Creating my avatar cube
const wesTexture = new THREE.TextureLoader().load('wes.jpg');
const wes = new THREE.Mesh(
    new THREE.BoxGeometry(3, 3, 3),
    new THREE.MeshBasicMaterial({
        map: wesTexture,
    })
);
scene.add(wes);
wes.rotation.y = 0.9;

function moveCamera() {
    const t = document.body.getBoundingClientRect().top; //This will get the position on the webpage that the user has already scrolled to. The "top" property will show us exactly how far we are from the top of the webpage.

    wes.rotation.y += 0.02;
    wes.rotation.z += 0.02;
    torus.position.z -= 5;
    torus1.position.z -= 0.1;
    torus2.position.z -= 0.1;

    camera.rotation.x = t * -0.00005;
}
document.body.onscroll = moveCamera; //This will make the camera move when we scroll. This is an event handler.
moveCamera();

var responsivenessCounter = 0;

window.addEventListener('resize', () => {
    // update display width and height
    width = window.innerWidth
    height = window.innerHeight
    // update camera aspect
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    // update renderer
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.render(scene, camera)
 })

 var titleName = document.querySelector("#title");
 var titleAnimationCounter = 0;

function animate() {
    requestAnimationFrame(animate);
    torus.position.x = camera.position.x + 10;
    torus.position.y = camera.position.y;
    torus.position.z = camera.position.z - 10;
    torus1.position.x = camera.position.x + 10;
    torus1.position.y = camera.position.y;
    torus1.position.z = camera.position.z - 10;
    torus2.position.x = camera.position.x + 10;
    torus2.position.y = camera.position.y;
    torus2.position.z = camera.position.z - 10;
    torus.rotation.x += 0.01;
    torus.rotation.y += 0.005;
    torus.rotation.z += 0.01;
    torus1.rotation.x += 0.005;
    torus1.rotation.y += 0.01;
    torus1.rotation.z += 0.01;
    torus2.rotation.x += 0.01;
    torus2.rotation.y += 0.01;
    torus2.rotation.z += 0.005;

    if(titleAnimationCounter%43 == 0)
    {
        titleName.innerText = "wesley's websitE";
    }else if(titleAnimationCounter%41 == 0)
    {
        titleName.innerText = "wesley's websiTe";
    }else if(titleAnimationCounter%37 == 0)
    {
        titleName.innerText = "wesley's websIte";
    }else if(titleAnimationCounter%31 == 0)
    {
        titleName.innerText = "wesley's webSite";
    }else if(titleAnimationCounter%29 == 0)
    {
        titleName.innerText = "wesley's weBsite";
    }else if(titleAnimationCounter%23 == 0)
    {
        titleName.innerText = "wesley's wEbsite";
    }else if(titleAnimationCounter%19 == 0)
    {
        titleName.innerText = "wesley's Website";
    }else if(titleAnimationCounter%17 == 0)
    {
        titleName.innerText = "wesley'S website";
    }else if(titleAnimationCounter%13 == 0)
    {
        titleName.innerText = "wesleY's website";
    }else if(titleAnimationCounter%11 == 0)
    {
        titleName.innerText = "weslEy's website";
    }else if(titleAnimationCounter%7 == 0)
    {
        titleName.innerText = "wesLey's website";
    }else if(titleAnimationCounter%5 == 0)
    {
        titleName.innerText = "weSley's website";
    }else if(titleAnimationCounter%3 == 0)
    {
        titleName.innerText = "wEsley's website";
    }else if(titleAnimationCounter%2 == 0)
    {
        titleName.innerText = "Wesley's website";
    }
    titleAnimationCounter = titleAnimationCounter + 1;

    wes.position.x = camera.position.x + 10;
    wes.position.y = camera.position.y;
    wes.position.z = camera.position.z - 10;

    if (responsivenessCounter % 10 == 0) {
        const geometry1 = new THREE.SphereGeometry(1.50, 24, 24);
        const material1 = new THREE.MeshStandardMaterial({
            color: 0xff0000,
        });
        const star1 = new THREE.Mesh(geometry1, material1);
        const [x1, y1, z1] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(1000)); //This randomly generates an x, y, and z position value for each star by filling an array with 3 values, then mapping each value to the ThreeJS random float spread function which is a helper function that randomly generates a number between negative and positive arguments, (100 in this case).
        star1.position.set(x1 + camera.position.x, y1 + camera.position.y, z1 + camera.position.z);//Then we will take those numbers from above and set it as the position of a star. Then we will add it to the scene.
        scene.add(star1);
        const geometry2 = new THREE.SphereGeometry(1.50, 24, 24);
        const material2 = new THREE.MeshStandardMaterial({
            color: 0x7DF9FF,
        });
        const star2 = new THREE.Mesh(geometry2, material2);
        const [x2, y2, z2] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(1000)); //This randomly generates an x, y, and z position value for each star by filling an array with 3 values, then mapping each value to the ThreeJS random float spread function which is a helper function that randomly generates a number between negative and positive arguments, (100 in this case).
        star2.position.set(x2 + camera.position.x, y2 + camera.position.y, z2 + camera.position.z);//Then we will take those numbers from above and set it as the position of a star. Then we will add it to the scene.
        scene.add(star2);
        const geometry3 = new THREE.SphereGeometry(1.50, 24, 24);
        const material3 = new THREE.MeshStandardMaterial({
            color: 0x50C878,
        });
        const star3 = new THREE.Mesh(geometry3, material3);
        const [x3, y3, z3] = Array(3).fill().map(() => THREE.MathUtils.randFloatSpread(1000)); //This randomly generates an x, y, and z position value for each star by filling an array with 3 values, then mapping each value to the ThreeJS random float spread function which is a helper function that randomly generates a number between negative and positive arguments, (100 in this case).
        star3.position.set(x3 + camera.position.x, y3 + camera.position.y, z3 + camera.position.z);//Then we will take those numbers from above and set it as the position of a star. Then we will add it to the scene.
        scene.add(star3);
    }

    //var colorPlus = colorPlus + 1;
    //console.log(colorPlus);
    //scene.background = new THREE.Color(colorPlus);
    responsivenessCounter++;
    //console.log(responsivenessCounter);

    camera.position.z += 0.5;

    renderer.render(scene, camera);
}
animate();