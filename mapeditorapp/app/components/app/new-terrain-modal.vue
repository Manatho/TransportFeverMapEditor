<template>
	<div v-show="render" class="modal">
		<div class="modal-content">
			<input class="textinput" v-model="name" name="newName" placeholder="Name" @keyup.enter="blur" @keypress="onkey">
			<input class="textinput" v-model="author" name="newAuthor" placeholder="Author" @keyup.enter="blur">
			<input class="textinput" v-model="profile" name="newProfile" placeholder="Steam Profile" @keyup.enter="blur">
			<div class="settings">
				<div class="setting">
					<h4>Size</h4>
					<label class="container" v-for="size in Sizes">
  						<input type="radio" name="newsize" class="radioinput" v-model="selectedSize" v-bind:value="size">
						  <span class="radio"></span>
  						<span class="radiotext">{{size}}</span>
					</label>
				</div>
				<div class="setting">
					<div style="display:flex">
						<h4>Scaling</h4>
						<div class="info">
							<span class="icon"></span>
							<span class="tooltip"
								>Terrain to pixel ratio: <br />
								Trades precision for performance <br/>
								(4 is a good starting point)
							</span>
						</div>
					</div>
					<label class="container" v-for="scale in Scales">
  						<input type="radio" name="newscale" class="radioinput" v-model="selectedScale" v-bind:value="scale">
						<span class="radio"></span>
  						<span class="radiotext">{{scale}}</span>
					</label>
				</div>
			</div>
			<button @click="createTerrain" class="button">Create</button>
			<button @click="render = false" class="button">Cancel</button>
		</div>
	</div>
</template>


<script>
import { Controller } from "../logic/controller.js";
export default {
	methods: {
		createTerrain() {
			let meta = {
				name: this.name == "" ? "map" : this.name,
				author: this.author,
				profile: this.profile
			};

			Controller.createNewTerrain(meta, this.selectedSize, this.selectedScale);
			this.render = false;
		},
		show() {
			this.render = true;
		},
		blur(event) {
			event.target.blur();
		},
		onkey(event) {
			let key = event.key;

			if ((this.name == "" && key.match(/[a-zA-Z]/g)) || (this.name != "" && key.match(/^[\w\-. ]+$/g))) {
				return true;
			}
			event.preventDefault();
		}
	},
	data() {
		return {
			Scales: [1, 2, 4, 8, 16, 32],
			Sizes: [1024, 2048, 3072, 4096, 5120, 6144],
			selectedScale: 4,
			selectedSize: 1024,
			name: "",
			author: "",
			profile: "",
			render: true
		};
	}
};
</script>

<style lang="scss" scoped>
@import "./../../style/variables.scss";
@import "./common styles/modal.scss";
</style>
