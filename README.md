# Cellular Data Visualization

An immersive 3D visualization of cellular data networks built with React Three Fiber. This project renders a dynamic, interactive representation of network signal propagation, density, and performance metrics using WebGL.

![Cellular Data Visualization Preview](preview.png)

## 🚀 Features

- **Interactive 3D Network Map**: Rotate, zoom, and explore the cellular data landscape in 3D space.
- **Micro-Animations**: Experience "breathing" camera movements and dynamic FOV adjustments for a truly immersive feel.
- **Real-Time Data Pulses**: Visualize data transmission with animated lines shooting outward and retracting in rhythmic pulses.
- **Adaptive Performance**: Automatically adjusts graphical fidelity (polygon count, bloom intensity) based on device capabilities.
- **Selective Bloom Effects**: Strategic use of post-processing bloom to highlight key data pathways without overwhelming the visual clarity.
- **Dynamic Text Labels**: Floating data points (hex codes, system stats) that populate the 3D space for contextual depth.

## 🛠️ Technologies Used

- **React**: UI component structure and state management.
- **Three.js**: Core 3D rendering engine.
- **React Three Fiber**: Declarative Three.js for React.
- **React Three Drei**: Useful helpers and abstractions for R3F.
- **Postprocessing**: Advanced visual effects like Bloom.

## 📦 Installation & Usage

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/yourusername/cellular-data-viz.git
    cd cellular-data-viz
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

4.  **Open in Browser:**
    Navigate to `http://localhost:5173` (or the port shown in your terminal) to view the visualization.


## 📱 Mobile Optimized

The application includes performance optimizations for mobile devices, reducing geometry complexity and adjusting effects to ensure smooth playback on phones and tablets.
